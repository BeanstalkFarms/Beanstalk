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

export function normalizeBN(
  value: BigNumber | undefined | null,
  _gt?: BigNumber.Value,
) {
  return (value && value.gt(_gt || 0) ? value : ZERO_BN);
}

export function tokenValueToBN(
  value: TokenValue | BigNumber
) {
  if (value instanceof BigNumber) return value;
  return new BigNumber(value.toHuman());
}

export function bnToTokenValue(token: Token, value: TokenValue | BigNumber) {
  if (value instanceof TokenValue) return value;
  return token.amount(value.toString());
}
