import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ethers } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { Silo } from "../silo";
import { TokenValue } from "@beanstalk/sdk-core";
import { TokenSiloBalance, Deposit } from "./types";
import { assert } from "src/utils";
import { SiloGettersFacet } from "src/constants/generated/protocol/abi/Beanstalk";

export function sortCrates(state: TokenSiloBalance) {
  state.deposits = state.deposits.sort(
    (a, b) => a.stem.sub(b.stem).toNumber() // sort by season asc
  );
}

/**
 * Order crates by Season.
 */
export function sortCratesByStem(crates: Deposit[], direction: "asc" | "desc" = "desc") {
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
export function pickCrates(
  deposits: Deposit[],
  amount: TokenValue,
  // TODO: remove these
  _token: Token,
  // TODO: remove these
  _currentSeason: number
) {
  let totalAmount = TokenValue.ZERO;
  let totalBDV = TokenValue.ZERO;
  let totalStalk = TokenValue.ZERO;

  const cratesToWithdrawFrom: Deposit[] = [];

  deposits.some((deposit) => {
    const amountToRemoveFromCrate = totalAmount.add(deposit.amount).lte(amount)
      ? deposit.amount
      : amount.sub(totalAmount);
    const cratePct = amountToRemoveFromCrate.div(deposit.amount);
    const crateBDV = cratePct.mul(deposit.bdv);
    const crateSeeds = cratePct.mul(deposit.seeds);

    const baseStalk = cratePct.mul(deposit.stalk.base);
    const grownStalk = cratePct.mul(deposit.stalk.grown);
    const crateStalk = cratePct.mul(deposit.stalk.total);

    totalAmount = totalAmount.add(amountToRemoveFromCrate);
    totalBDV = totalBDV.add(crateBDV);
    totalStalk = totalStalk.add(crateStalk);

    cratesToWithdrawFrom.push({
      id: deposit.id,
      stem: deposit.stem,
      amount: amountToRemoveFromCrate,
      bdv: crateBDV,
      stalk: {
        total: crateStalk,
        base: baseStalk,
        grown: grownStalk
      },
      seeds: crateSeeds,
      isGerminating: deposit.isGerminating
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
    convertibleAmount: TokenValue.ZERO,
    bdv: TokenValue.ZERO,
    deposits: [] as Deposit[],
    convertibleDeposits: [] as Deposit[]
  };
}

export function packAddressAndStem(address: string, stem: ethers.BigNumber): ethers.BigNumber {
  const addressBN = ethers.BigNumber.from(address);
  const shiftedAddress = addressBN.shl(96);
  const stemUint = stem.toTwos(96);
  return shiftedAddress.or(stemUint);
}

export function unpackAddressAndStem(data: ethers.BigNumber): {
  tokenAddress: string;
  stem: ethers.BigNumber;
} {
  const tokenAddressBN = data.shr(96);
  const tokenAddress = ethers.utils.getAddress(tokenAddressBN.toHexString());
  const stem = data.mask(96).fromTwos(96);
  return { tokenAddress, stem };
}

type TokenDepositsByStem = {
  [stem: string]: {
    id: ethers.BigNumber;
    amount: ethers.BigNumber;
    bdv: ethers.BigNumber;
  };
};

export function parseDepositsByToken(
  sdk: BeanstalkSDK,
  data: SiloGettersFacet.TokenDepositIdStructOutput[]
) {
  const depositsByToken: Map<Token, TokenDepositsByStem> = new Map();
  data.forEach(({ token: tokenAddr, depositIds, tokenDeposits }) => {
    const token = sdk.tokens.findByAddress(tokenAddr);
    if (!token) return;

    const depositsByStem = depositIds.reduce<TokenDepositsByStem>((memo, depositId, index) => {
      const { stem } = unpackAddressAndStem(depositId);
      const deposit = tokenDeposits[index];

      memo[stem.toString()] = {
        id: depositId,
        amount: deposit.amount,
        bdv: deposit.bdv
      };

      return memo;
    }, {});

    depositsByToken.set(token, depositsByStem);
  });

  return depositsByToken;
}

export type RawDepositData = {
  id: ethers.BigNumber;
  stem: ethers.BigNumberish;
  amount: ethers.BigNumberish;
  bdv: ethers.BigNumberish;
  germinatingStem: ethers.BigNumber;
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
export function makeDepositObject(
  token: Token,
  stemTipForToken: ethers.BigNumber,
  data: RawDepositData
): Deposit {
  // On-chain
  let stem;
  const amount = token.fromBlockchain(data.amount.toString());
  const bdv = Silo.sdk.tokens.BEAN.fromBlockchain(data.bdv.toString()); // Hack
  // Hack - Remove additional digits added to stem of redeposited unripe tokens in migrateStem
  if (token.isUnripe && !ethers.BigNumber.from(data.stem).isNegative()) {
    stem = ethers.BigNumber.from(data.stem).div(1000000);
  } else {
    stem = ethers.BigNumber.from(data.stem);
  }
  const isGerminating = stem.gte(data.germinatingStem);

  // Stalk
  // Germinating stalk has 0 base stalk
  const base = isGerminating ? TokenValue.ZERO : token.getStalk(bdv);
  const grown = calculateGrownStalkStems(stemTipForToken, stem, bdv);
  const total = base.add(grown);

  return {
    id: data.id,
    stem,
    amount,
    bdv,
    stalk: {
      base,
      grown,
      total
    },
    seeds: token.getSeeds(bdv),
    isGerminating
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
  assert(
    deltaSeasons.gte(0),
    "Silo: Cannot calculate grown stalk when `currentSeason < depositSeason`."
  );
  return Silo.STALK_PER_SEED_PER_SEASON.mul(depositSeeds).mul(deltaSeasons.toNumber());
}

/**
 * Formula: `grownStalk = bdv * (stemTip - stem)`
 * See: LibTokenSilo.grownStalkForDeposit
 *
 * The grown stalk for a deposit (this applies to both germinating and regular deposits) is calculated by:
 * ∆Stem * bdv / 1e6 (where bdv is in 6 decimal precision, "1" bdv = 1e6)
 * ∆Stem = StemTip - Stem of deposit.
 *
 * @param stemTip The current stem tip for the token that is deposited
 * @param stem The stem of the deposit
 * @param bdv The bdv of the deposit
 */
export function calculateGrownStalkStems(
  stemTip: ethers.BigNumber,
  stem: ethers.BigNumber,
  bdv: TokenValue
) {
  const deltaStem = stemTip.sub(stem).div(10 ** 6);

  if (deltaStem.lt(0)) return Silo.sdk.tokens.STALK.fromHuman("0"); // FIXME
  return Silo.sdk.tokens.STALK.fromBlockchain(bdv.toBigNumber().mul(deltaStem));
}

/**
 * Apply a Deposit to a TokenSiloBalance.
 */
export function applyDeposit(
  balance: TokenSiloBalance,
  token: Token,
  stemTipForToken: ethers.BigNumber,
  data: RawDepositData
) {
  const deposit = makeDepositObject(token, stemTipForToken, data);

  balance.amount = balance.amount.add(deposit.amount);
  balance.convertibleAmount = balance.convertibleAmount.add(
    deposit.isGerminating ? TokenValue.ZERO : deposit.amount
  );
  balance.bdv = balance.bdv.add(deposit.bdv);
  balance.deposits.push(deposit);
  if (!deposit.isGerminating) {
    balance.convertibleDeposits.push(deposit);
  }

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
