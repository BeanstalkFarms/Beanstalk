import { BigNumber, ethers } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { EventProcessorData } from "src/lib/events/processor";
import { Silo } from "../silo";
import { TokenValue } from "@beanstalk/sdk-core";
import { Crate, TokenSiloBalance, WithdrawalCrate, DepositCrate, MapValueType } from "./types";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { assert } from "src/utils";

/**
 * Beanstalk doesn't automatically re-categorize withdrawals as "claimable".
 * "Claimable" just means that the `season` parameter stored in the withdrawal
 * event is less than or equal to the current `season()`.
 *
 * This function serves two purposes:
 * 1. Break generic withdrawals into
 *    "withdrawn" (aka transit), which cannot yet be claimed
 *    "claimable" (aka receivable), which are eligible to be claimed
 * 2. Convert each crate amount to the appropriate number of decimals.
 */
export const parseWithdrawalCrates = (
  token: Token,
  withdrawals: MapValueType<EventProcessorData["withdrawals"]>,
  currentSeason: BigNumber
): {
  withdrawn: TokenSiloBalance["withdrawn"];
  claimable: TokenSiloBalance["claimable"];
} => {
  let withdrawnBalance = TokenValue.ZERO; // aka "transit"
  let claimableBalance = TokenValue.ZERO; // aka "receivable"
  const withdrawn: WithdrawalCrate[] = []; // aka "transit"
  const claimable: WithdrawalCrate[] = []; // aka "receivable"

  // Split each withdrawal between `receivable` and `transit`.
  Object.keys(withdrawals).forEach((season) => {
    const amt = TokenValue.fromBlockchain(withdrawals[season].amount, token.decimals);
    const szn = BigNumber.from(season);
    if (szn.lte(currentSeason)) {
      claimableBalance = claimableBalance.add(amt);
      claimable.push({
        amount: amt,
        season: szn
      });
    } else {
      withdrawnBalance = withdrawnBalance.add(amt);
      withdrawn.push({
        amount: amt,
        season: szn
      });
    }
  });

  return {
    withdrawn: {
      amount: withdrawnBalance,
      crates: withdrawn
    },
    claimable: {
      amount: claimableBalance,
      crates: claimable
    }
  };
};

export function sortCrates(state: TokenSiloBalance["deposited" | "withdrawn" | "claimable"]) {
  state.crates = state.crates.sort(
    (a, b) => a.season.sub(b.season).toNumber() // sort by season asc
  );
}

/**
 * Order crates by Season.
 */
export function sortCratesBySeason<T extends Crate<TokenValue>>(crates: T[], direction: "asc" | "desc" = "desc") {
  const m = direction === "asc" ? -1 : 1;
  return [...crates].sort((a, b) => m * b.season.sub(a.season).toNumber());
}

/**
 * Order crates by BDV.
 */
export function sortCratesByBDVRatio<T extends DepositCrate<TokenValue>>(crates: T[], direction: "asc" | "desc" = "asc") {
  const m = direction === "asc" ? -1 : 1;
  return [...crates].sort((a, b) => {
    // FIXME
    const _a:TokenValue = a.bdv.div(a.amount);
    const _b:TokenValue = b.bdv.div(b.amount);
    return parseFloat(_b.sub(_a).mul(m).toHuman())
  });
}

/**
 * Selects the number of crates needed to add up to the desired `amount`.
 */
export function pickCrates(crates: DepositCrate[], amount: TokenValue, token: Token, currentSeason: number) {
  let totalAmount = TokenValue.ZERO;
  let totalBDV = TokenValue.ZERO;
  let totalStalk = TokenValue.ZERO;
  const cratesToWithdrawFrom: DepositCrate[] = [];

  crates.some((crate) => {
    const amountToRemoveFromCrate = totalAmount.add(crate.amount).lte(amount) ? crate.amount : amount.sub(totalAmount);
    const elapsedSeasons = currentSeason - crate.season.toNumber();
    const cratePct = amountToRemoveFromCrate.div(crate.amount);
    const crateBDV = cratePct.mul(crate.bdv);
    const crateSeeds = cratePct.mul(crate.seeds);
    const baseStalk = token.getStalk(crateBDV);
    const grownStalk = crateSeeds.mul(elapsedSeasons).mul(Silo.STALK_PER_SEED_PER_SEASON);
    const crateStalk = baseStalk.add(grownStalk);

    totalAmount = totalAmount.add(amountToRemoveFromCrate);
    totalBDV = totalBDV.add(crateBDV);
    totalStalk = totalStalk.add(crateStalk);

    cratesToWithdrawFrom.push({
      season: crate.season,
      amount: amountToRemoveFromCrate,
      bdv: crateBDV,
      stalk: crateStalk,
      baseStalk: baseStalk,
      grownStalk: grownStalk,
      seeds: crateSeeds
    });

    return totalAmount.eq(amount);
  });

  if (totalAmount.lt(amount)) {
    throw new Error("Not enough deposits");
  }

  return {
    totalAmount,
    totalBDV,
    totalStalk,
    crates: cratesToWithdrawFrom
  };
}

/**
 * Sort the incoming map so that tokens are ordered in the same order
 * they appear on the Silo Whitelist.
 *
 * @note the Silo Whitelist is sorted by the order in which tokens were
 * whitelisted in Beanstalk. Unclear if the ordering shown on the
 * Beanstalk UI will change at some point in the future.
 */
export function sortTokenMapByWhitelist<T extends any>(whitelist: Set<Token>, map: Map<Token, T>) {
  const copy = new Map<Token, T>(map);
  const ordered = new Map<Token, T>();
  // by default, order by whitelist
  whitelist.forEach((token) => {
    const v = copy.get(token);
    if (v) {
      ordered.set(token, v);
      copy.delete(token);
    }
  });
  // add remaining tokens
  copy.forEach((_, token) => {
    ordered.set(token, copy.get(token)!);
  });
  return ordered;
}

export function makeTokenSiloBalance(): TokenSiloBalance {
  return {
    deposited: {
      amount: TokenValue.ZERO,
      bdv: TokenValue.ZERO,
      crates: [] as DepositCrate[]
    },
    withdrawn: {
      amount: TokenValue.ZERO,
      crates: [] as WithdrawalCrate[]
    },
    claimable: {
      amount: TokenValue.ZERO,
      crates: [] as WithdrawalCrate[]
    }
  };
}

/**
 * Create a new Deposit Crate object.
 *
 * @param token Token contained within the crate
 * @param _season The season of deposit
 * @param _amount The amount of deposit
 * @param _bdv The bdv of deposit
 * @param currentSeason The current season, for calculation of grownStalk.
 * @returns DepositCrate<TokenValue>
 */
export function makeDepositCrate(
  token: Token,
  _season: string | number,
  _amount: string,
  _bdv: string,
  currentSeason: ethers.BigNumberish
): DepositCrate<TokenValue> {
  // Crate
  const season = ethers.BigNumber.from(_season);
  const amount = token.fromBlockchain(_amount);

  // Deposit-specific
  const bdv = Silo.sdk.tokens.BEAN.fromBlockchain(_bdv);
  const seeds = token.getSeeds(bdv);
  const baseStalk = token.getStalk(bdv);
  const grownStalk = calculateGrownStalk(currentSeason, season, seeds);
  const stalk = baseStalk.add(grownStalk);

  return {
    season,
    amount,
    bdv,
    stalk,
    baseStalk,
    grownStalk,
    seeds
  };
}

/**
 * Calculate the amount Stalk grown since `depositSeason`.
 * Depends on the `currentSeason` and the `depositSeeds` awarded
 * for a particular deposit.
 *
 * @param currentSeason
 * @param depositSeason
 * @param depositSeeds
 * @returns TokenValue<STALK>
 */
export function calculateGrownStalk(
  currentSeason: ethers.BigNumberish,
  depositSeason: ethers.BigNumberish,
  depositSeeds: TokenValue
): TokenValue {
  const deltaSeasons = ethers.BigNumber.from(currentSeason).sub(depositSeason);
  assert(deltaSeasons.gte(0), "Silo: Cannot calculate grown stalk when `currentSeason < depositSeason`.");
  return Silo.STALK_PER_SEED_PER_SEASON.mul(depositSeeds).mul(deltaSeasons.toNumber());
}

/**
 * Apply a Deposit to a TokenSiloBalance.
 * @note expects inputs to be stringified (no decimals).
 */
export function applyDeposit(
  state: TokenSiloBalance["deposited"],
  token: Token,
  rawCrate: {
    season: string | number;
    amount: string;
    bdv: string;
  },
  currentSeason: ethers.BigNumberish
) {
  const crate = makeDepositCrate(token, rawCrate.season, rawCrate.amount, rawCrate.bdv, currentSeason);

  state.amount = state.amount.add(crate.amount);
  state.bdv = state.bdv.add(crate.bdv);
  state.crates.push(crate);

  return crate;
}

/**
 * Apply a Deposit to a TokenSiloBalance.
 *
 * @note expects inputs to be stringified (no decimals).
 */
export function applyWithdrawal(
  state: TokenSiloBalance["withdrawn" | "claimable"],
  token: Token,
  rawCrate: {
    season: string | number;
    amount: string;
  }
) {
  const season = BigNumber.from(rawCrate.season);
  const amount = token.amount(rawCrate.amount);

  const crate: Crate<TokenValue> = {
    season: season,
    amount: amount
  };

  state.amount = state.amount.add(amount);
  state.crates.push(crate);

  return crate;
}

export function sumDeposits(token: ERC20Token, crates: DepositCrate[]) {
  return crates.reduce(
    (prev, curr) => {
      prev.amount = prev.amount.add(curr.amount);
      prev.stalk = prev.stalk.add(curr.stalk);
      prev.seeds = prev.seeds.add(curr.seeds);
      prev.bdv = prev.bdv.add(curr.bdv);
      return prev;
    },
    {
      amount: token.amount(0),
      stalk: Silo.sdk.tokens.STALK.amount(0),
      seeds: Silo.sdk.tokens.SEEDS.amount(0),
      bdv: Silo.sdk.tokens.BEAN.amount(0)
    }
  );
}
