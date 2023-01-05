import { BigNumber } from "ethers";
import { Token } from "src/classes/Token";
import { EventProcessorData } from "./events/processor";
import { EIP712PermitMessage } from "./permit";
import { Crate, DepositCrate, TokenSiloBalance, WithdrawalCrate } from "./silo";
import { TokenValue } from "src/classes/TokenValue";

export type MapValueType<A> = A extends Map<any, infer V> ? V : never;

// FIXME: resolve with EIP712PermitMessage
export type DepositTokenPermitMessage = EIP712PermitMessage<{
  token: string;
  value: number | string;
}>;

export type DepositTokensPermitMessage = EIP712PermitMessage<{
  tokens: string[];
  values: (number | string)[];
}>;

export type CrateSortFn = <T extends Crate<TokenValue>>(crates: T[]) => T[];

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
export const _parseWithdrawalCrates = (
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
    const _a = a.bdv.div(a.amount);
    const _b = b.bdv.div(b.amount);
    return m * _b.sub(_a).toBigNumber().toNumber();
  });
}
