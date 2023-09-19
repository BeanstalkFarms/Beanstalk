import { Token, TokenValue } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';

export const BN = (v: BigNumber.Value) => new BigNumber(v);

// @ts-ignore
// BigNumber.prototype.toJSON = function toJSON() {
//   return {
//     type: 'BigNumber.js',
//     // bignumber can rehydrate hex numbers with decimals
//     // 0x4.5c316a055757d5a9eb2 = 4.360129
//     hex: `0x${this.toString(16)}`,
//   };
// };

/**
 * Calculates the logarithm of a BigNumber value with a specified base.
 * @param base - The base of the logarithm.
 * @param value - The value for which to calculate the logarithm.
 * @returns result of the logarithm calculation.
 */
export const logBN = (_base: number, value: BigNumber): BigNumber => {
  const base = BigNumber.isBigNumber(_base) ? _base.toNumber() : _base;

  // Calculate the natural logarithm of the base using JavaScript's Math.log
  const naturalLogBase = new BigNumber(Math.log(base));

  // Calculate the natural logarithm of the value
  const naturalLogValue = new BigNumber(Math.log(value.toNumber()));

  // Divide the natural logarithm of the value by the natural logarithm of the base
  // to calculate the logarithm with the specified base
  return naturalLogValue.dividedBy(naturalLogBase);
};
export function normalizeBN(
  value: BigNumber | undefined | null,
  _gt?: BigNumber.Value
) {
  return value && value.gt(_gt || 0) ? value : ZERO_BN;
}

export function tokenValueToBN(value: TokenValue | BigNumber) {
  if (value instanceof BigNumber) return value;
  return new BigNumber(value.toHuman());
}

export function bnToTokenValue(token: Token, value: TokenValue | BigNumber) {
  if (value instanceof TokenValue) return value;
  return token.amount(value.toString());
}
