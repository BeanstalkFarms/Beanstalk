import BigNumber from 'bignumber.js';

import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
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
  if (source === BalanceFrom.EXTERNAL) return balance.external;
  if (source === BalanceFrom.INTERNAL) return balance.internal;
  throw new Error('RFF requires a single balance source');
}

export function balanceModeForSource(source: BalanceFrom): BalanceMode {
  if (source === BalanceFrom.EXTERNAL) return BalanceMode.EXTERNAL;
  if (source === BalanceFrom.INTERNAL) return BalanceMode.INTERNAL;
  throw new Error('RFF requires a single balance source');
}
