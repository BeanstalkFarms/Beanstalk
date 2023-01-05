import BigNumber from 'bignumber.js';

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
