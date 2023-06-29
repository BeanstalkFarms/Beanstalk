import { ethers } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { Silo } from "../silo";
import { TokenValue } from "@beanstalk/sdk-core";
import { TokenSiloBalance, Deposit } from "./types";
import { assert } from "src/utils";

export function sortCrates(state: TokenSiloBalance) {
  state.deposits = state.deposits.sort(
    (a, b) => a.stem.sub(b.stem).toNumber() // sort by season asc
  );
}

/**
 * Order crates by Season.
 */
export function sortCratesBySeason(crates: Deposit[], direction: "asc" | "desc" = "desc") {
  const m = direction === "asc" ? -1 : 1;
  return [...crates].sort((a, b) => m * b.stem.sub(a.stem).toNumber());
}

/**
 * Order crates by BDV.
 */
export function sortCratesByBDVRatio(crates: Deposit[], direction: "asc" | "desc" = "asc") {
  const m = direction === "asc" ? -1 : 1;
  return [...crates].sort((a, b) => {
    // FIXME
    const _a: TokenValue = a.bdv.div(a.amount);
    const _b: TokenValue = b.bdv.div(b.amount);
    return parseFloat(_b.sub(_a).mul(m).toHuman());
  });
}

/**
 * Selects the number of crates needed to add up to the desired `amount`.
 */
export function pickCrates(deposits: Deposit[], amount: TokenValue, token: Token, currentSeason: number) {
  let totalAmount = TokenValue.ZERO;
  let totalBDV = TokenValue.ZERO;
  let totalStalk = TokenValue.ZERO;
  const cratesToWithdrawFrom: Deposit[] = [];

  deposits.some((deposit) => {
    const amountToRemoveFromCrate = totalAmount.add(deposit.amount).lte(amount) ? deposit.amount : amount.sub(totalAmount);
    const elapsedSeasons = currentSeason - deposit.stem.toNumber();
    const cratePct = amountToRemoveFromCrate.div(deposit.amount);
    const crateBDV = cratePct.mul(deposit.bdv);
    const crateSeeds = cratePct.mul(deposit.seeds);

    const baseStalk = token.getStalk(crateBDV);
    const grownStalk = crateSeeds.mul(elapsedSeasons).mul(Silo.STALK_PER_SEED_PER_SEASON); // FIXME
    const crateStalk = baseStalk.add(grownStalk);

    totalAmount = totalAmount.add(amountToRemoveFromCrate);
    totalBDV = totalBDV.add(crateBDV);
    totalStalk = totalStalk.add(crateStalk);

    cratesToWithdrawFrom.push({
      stem: deposit.stem,
      amount: amountToRemoveFromCrate,
      bdv: crateBDV,
      stalk: {
        total: crateStalk,
        base: baseStalk,
        grown: grownStalk
      },
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
    amount: TokenValue.ZERO,
    bdv: TokenValue.ZERO,
    deposits: [] as Deposit[]
  };
}

export type RawDepositData = {
  stem: ethers.BigNumberish;
  amount: ethers.BigNumberish;
  bdv: ethers.BigNumberish;
};

/**
 * Create a new Deposit object.
 *
 * @param token Token contained within the crate
 * @param stemTipForToken The current stem tip for this token, for calculation of grownStalk.
 * @param data.stem The stem (identifier) of this Deposit
 * @param data.amount The amount of deposit
 * @param data.bdv The bdv of deposit
 * @returns DepositCrate<TokenValue>
 */
export function makeDepositObject(token: Token, stemTipForToken: ethers.BigNumber, data: RawDepositData): Deposit {
  // On-chain
  const stem = ethers.BigNumber.from(data.stem);
  const amount = token.fromBlockchain(data.amount.toString());
  const bdv = Silo.sdk.tokens.BEAN.fromBlockchain(data.bdv.toString()); // Hack

  // Stalk
  const base = token.getStalk(bdv);
  const grown = calculateGrownStalkStems(stemTipForToken, stem, bdv);
  const total = base.add(grown);

  return {
    stem,
    amount,
    bdv,
    stalk: {
      base,
      grown,
      total
    },
    seeds: Silo.sdk.tokens.SEEDS.fromHuman("0") // FIXME
  };
}

/**
 * @deprecated Calculate the amount Stalk grown since `depositSeason`.
 * Depends on the `currentSeason` and the `depositSeeds` awarded
 * for a particular deposit.
 */
export function calculateGrownStalkSeeds(
  currentSeason: ethers.BigNumberish,
  depositSeason: ethers.BigNumberish,
  depositSeeds: TokenValue
): TokenValue {
  const deltaSeasons = ethers.BigNumber.from(currentSeason).sub(depositSeason);
  assert(deltaSeasons.gte(0), "Silo: Cannot calculate grown stalk when `currentSeason < depositSeason`.");
  return Silo.STALK_PER_SEED_PER_SEASON.mul(depositSeeds).mul(deltaSeasons.toNumber());
}

/**
 * Formula: `grownStalk = bdv * (stemTip - stem)`
 * See: LibTokenSilo.grownStalkForDeposit
 *
 * @param stemTip The current stem tip for the token that is deposited
 * @param stem The stem of the deposit
 * @param bdv The bdv of the deposit
 */
export function calculateGrownStalkStems(stemTip: ethers.BigNumber, stem: ethers.BigNumber, bdv: TokenValue) {
  const deltaStem = stemTip.sub(stem);
  if (deltaStem.lt(0)) return Silo.sdk.tokens.STALK.fromHuman("0"); // FIXME
  return Silo.sdk.tokens.STALK.fromBlockchain(bdv.toBigNumber().mul(deltaStem));
}

/**
 * Apply a Deposit to a TokenSiloBalance.
 * TODO: refactor to accept currentStem instead of currentSeason
 * @note expects inputs to be stringified (no decimals).
 */
export function applyDeposit(balance: TokenSiloBalance, token: Token, stemTipForToken: ethers.BigNumber, data: RawDepositData) {
  const deposit = makeDepositObject(token, stemTipForToken, data);

  balance.amount = balance.amount.add(deposit.amount);
  balance.bdv = balance.bdv.add(deposit.bdv);
  balance.deposits.push(deposit);

  return deposit;
}

export function sumDeposits(token: ERC20Token, crates: Deposit[]) {
  return crates.reduce(
    (prev, curr) => {
      prev.amount = prev.amount.add(curr.amount);
      prev.stalk = prev.stalk.add(curr.stalk.total);
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
