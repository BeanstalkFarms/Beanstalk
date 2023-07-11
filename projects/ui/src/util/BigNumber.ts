import { Token, TokenValue } from '@beanstalk/sdk';
import BignumberJS from 'bignumber.js';
import { ethers } from 'ethers';
import { ZERO_BN } from '~/constants';

export const BN = (v: BignumberJS.Value) => new BignumberJS(v);

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
export const logBN = (_base: number, value: BignumberJS): BignumberJS => {
  const base = BignumberJS.isBigNumber(_base) ? _base.toNumber() : _base;

  // Calculate the natural logarithm of the base using JavaScript's Math.log
  const naturalLogBase = new BignumberJS(Math.log(base));

  // Calculate the natural logarithm of the value
  const naturalLogValue = new BignumberJS(Math.log(value.toNumber()));

  // Divide the natural logarithm of the value by the natural logarithm of the base
  // to calculate the logarithm with the specified base
  return naturalLogValue.dividedBy(naturalLogBase);
};
export function normalizeBN(
  value: BignumberJS | undefined | null,
  _gt?: BignumberJS.Value
) {
  return value && value.gt(_gt || 0) ? value : ZERO_BN;
}

// ////////////// Transformers ////////////////

export function tokenValueToBN(value: TokenValue | BignumberJS) {
  if (value instanceof BignumberJS) return value;
  return new BignumberJS(value.toHuman());
}

export function bnToTokenValue(token: Token, value: TokenValue | BignumberJS) {
  if (value instanceof TokenValue) return value;
  return token.amount(value.toString());
}

type NumberInputInstance = TokenValue | BignumberJS | ethers.BigNumber;
type OutputClassMap = {
  bnjs: BignumberJS;
  ethers: ethers.BigNumber;
  tokenValue: TokenValue;
};
type OutputOptions = keyof OutputClassMap;

/**
 * Transform between TokenValue, BignumberJS, and ethers.BigNumber.
 *
 * This is a helper to prevent massive refactoring ahead of Silo V3 launch. This
 * should later be removed.
 *
 * HEADS UP: TokenValue -> BignumberJS uses .toHuman(), which is the most common behavior.
 */
export function transform<O extends OutputOptions, R = OutputClassMap[O]>(
  value: string | NumberInputInstance,
  out: O,
  token?: Token
): R {
  if (typeof value === 'string') {
    value = ethers.BigNumber.from(value);
  }

  if (value instanceof TokenValue) {
    if (out === 'tokenValue') return value as R;
    if (out === 'bnjs') return new BignumberJS(value.toHuman()) as R;
    if (out === 'ethers') return value.toBigNumber() as R;
  }

  if (value instanceof BignumberJS) {
    if (out === 'tokenValue') {
      if (!token)
        throw new Error(
          "Can't transform BignumberJS to TokenValue without token"
        );
      return token.fromHuman(value.toString()) as R;
    }
    if (out === 'bnjs') return value as R;
    if (out === 'ethers') {
      // TODO: require a `Token` instance here?
      return ethers.BigNumber.from(value.toString()) as R;
    }
  }

  if (value instanceof ethers.BigNumber) {
    if (out === 'tokenValue') {
      if (!token)
        throw new Error(
          "Can't transform ethers.BigNumber to TokenValue without token"
        );
      return token.fromBlockchain(value.toString()) as R;
    }
    if (out === 'bnjs') {
      return token
        ? (new BignumberJS(token.fromBlockchain(value).toHuman()) as R)
        : (new BignumberJS(value.toString()) as R);
    }
    if (out === 'ethers') return value as R;
  }

  throw new Error(`Can't transform ${value} to ${out}`);
}

export function translate(out: OutputOptions, token?: Token) {
  return (value: NumberInputInstance) => transform(value, out, token);
}
