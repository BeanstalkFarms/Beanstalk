import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import { FarmFromMode } from '~/lib/Beanstalk/Farm';
import { Balance } from '~/state/farmer/balances';

/**
 * Apply the gas minimization strategy:
 *      if (amountIn <= internal)      return INTERNAL
 *      else if (amountIn <= external) return EXTERNAL
 *      else                           return INTERNAL_EXTERNAL
 * 
 * TODO: Farm assets strategy:
 *      always use some internal if it exists
 *      then use external
 * 
 * @param amountIn amount of token the user wants to spend from Balance.
 * @param balance Balance struct containing INTERNAL / EXTERNAL info.
 * @returns FarmFromMode
 */
export const optimizeFromMode = (
  amountIn: BigNumber,
  balance: Balance,
) : FarmFromMode => {
  const { internal, external, total } = balance;
  if (amountIn.gt(total))     throw new Error('Amount in is greater than total balance. INTERNAL_EXTERNAL_TOLERANT not yet supported.');
  if (amountIn.lte(internal)) return FarmFromMode.INTERNAL;
  if (amountIn.lte(external)) return FarmFromMode.EXTERNAL;
  return FarmFromMode.INTERNAL_EXTERNAL;
};

/**
 * Combine multiple balances into one Balance struct.
 * Example: combining ETH + WETH balance for display.
 * @returns Balance
 */
export const combineBalances = (
  ...balances: Balance[]
) : Balance => [...balances].reduce((prev, curr) => {
  prev.internal = prev.internal.plus(curr.internal);
  prev.external = prev.external.plus(curr.external);
  prev.total    = prev.total.plus(curr.total);
  return prev;
}, {
  internal: ZERO_BN,
  external: ZERO_BN,
  total:    ZERO_BN,
});
