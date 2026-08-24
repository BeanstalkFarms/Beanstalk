import BigNumber from 'bignumber.js';

import type { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { BalanceMode } from '~/lib/Rff/request';

type SourceBalances = {
  internal: BigNumber;
  external: BigNumber;
  total: BigNumber;
};

export function balanceForSource(
  balance: SourceBalances | undefined,
  source: BalanceFrom
): BigNumber {
  if (!balance) return new BigNumber(0);
  if (source === 'external') return balance.external;
  if (source === 'internal') return balance.internal;
  throw new Error('RFF requires a single balance source');
}

export function balanceModeForSource(source: BalanceFrom): BalanceMode {
  if (source === 'external') return BalanceMode.EXTERNAL;
  if (source === 'internal') return BalanceMode.INTERNAL;
  throw new Error('RFF requires a single balance source');
}

export function oracleAmountOut(input: {
  amountIn: bigint;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  tokenInUsd: BigNumber;
  tokenOutUsd: BigNumber;
}): bigint {
  if (
    input.amountIn <= 0n ||
    !input.tokenInUsd.isFinite() ||
    !input.tokenOutUsd.isFinite() ||
    input.tokenInUsd.lte(0) ||
    input.tokenOutUsd.lte(0)
  ) {
    return 0n;
  }

  const humanAmountIn = new BigNumber(input.amountIn.toString()).shiftedBy(
    -input.tokenInDecimals
  );
  const rawAmountOut = humanAmountIn
    .times(input.tokenInUsd)
    .div(input.tokenOutUsd)
    .shiftedBy(input.tokenOutDecimals)
    .integerValue(BigNumber.ROUND_DOWN);

  return rawAmountOut.gt(0) ? BigInt(rawAmountOut.toFixed(0)) : 0n;
}

export function recipientForConnectedAccount(account?: string): string {
  return account || '';
}

export function isRffChain(
  connectedChainId: number | undefined,
  configuredChainId: number
): boolean {
  return connectedChainId === configuredChainId;
}

const RFF_ORACLE_QUOTE_MAX_AGE_MS = 2 * 60 * 1000;

export function isRffOracleQuoteFresh(
  fetchedAtMs: number | undefined,
  nowMs: number
): boolean {
  return (
    fetchedAtMs !== undefined &&
    nowMs - fetchedAtMs <= RFF_ORACLE_QUOTE_MAX_AGE_MS
  );
}
