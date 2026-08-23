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

export function rffQuoteKey(tokenIn: string, amountIn: bigint): string {
  return `${tokenIn.toLowerCase()}:${amountIn.toString()}`;
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
