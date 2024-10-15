/* eslint-disable no-redeclare */
import BigNumber from 'bignumber.js';
import { NativeToken, Token, TokenValue } from '@beanstalk/sdk';
import LegacyToken, { NativeToken as LegacyNativeToken } from '~/classes/Token';
import { STALK } from '~/constants/tokens';
import { TokenInstance } from '~/hooks/beanstalk/useTokens';
import { ChainResolver } from '@beanstalk/sdk-core';
import { tokenValueToBN } from './BigNumber';
import { exists, stringsEqual } from './UI';

// -------------------------
// BigNumber Comparators
// -------------------------

export function MinBNs(arr: BigNumber[]): BigNumber {
  return arr.reduce((prev, curr) => {
    if (prev.isLessThanOrEqualTo(curr)) {
      return prev;
    }
    return curr;
  });
}

export function MaxBNs(arr: BigNumber[]): BigNumber {
  return arr.reduce((prev, curr) => (prev.isGreaterThan(curr) ? prev : curr));
}

export function MinBN(bn1: BigNumber, bn2: BigNumber): BigNumber {
  if (bn1.isLessThanOrEqualTo(bn2)) return bn1;
  return bn2;
}

export function MaxBN(bn1: BigNumber, bn2: BigNumber): BigNumber {
  if (bn1.isGreaterThan(bn2)) return bn1;
  return bn2;
}

// -------------------------
// BigNumber Display Helpers
// -------------------------

/**
 * Trim a BigNumber to a set number of decimals.
 *
 * @FIXME legacy code, seems very inefficient.
 */
export function TrimBN(
  bn: BigNumber,
  decimals: number,
  allowNegative: boolean = false
): BigNumber {
  if (typeof bn !== 'object') return new BigNumber(bn);

  const numberString = bn.toString();
  const decimalComponents = numberString.split('.');
  if ((bn.isLessThan(0) && !allowNegative) || decimalComponents.length < 2)
    return bn;

  // If too many decimals are provided, trim them.
  // If there aren't enough decimals, do nothing.
  // 1.123456 => [1, 123456]
  const decimalsFound = decimalComponents[1].length;
  const decimalsToTrim =
    decimalsFound < decimals ? 0 : decimalsFound - decimals;

  return new BigNumber(
    numberString.substr(0, numberString.length - decimalsToTrim)
  );
}

/**
 * Display a BigNumber with the specified range of decimals.
 */
export function displayFullBN(
  _bn: BigNumber | TokenValue,
  maxDecimals: number = 18,
  minDecimals: number = 0,
  tildeNearZero: boolean = false
) {
  const bn = BigNumber.isBigNumber(_bn) ? _bn : tokenValueToBN(_bn);

  const amt = bn.toNumber().toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });

  if (bn.gt(0) && amt === '0' && tildeNearZero) {
    return '~0';
  }

  const bnAbs = bn.abs();
  const lowestAmt = BigNumber(1).div(BigNumber(10).pow(maxDecimals));
  if (bnAbs.lt(lowestAmt) && bnAbs.gt(0)) {
    if (bn.gt(0)) return `<${lowestAmt.toString()}`;
    if (bn.lt(0)) return `- <${lowestAmt.toString()}`;
  }

  return amt;
}

/**
 * Display an amount of a Token. Uses the Token's preferred
 * displayDecimals for display. Includes the Token name.
 */
export function displayTokenAmount(
  _amount: BigNumber | TokenValue,
  token: LegacyToken | Token,
  config: {
    allowNegative?: boolean;
    showName?: boolean;
    showSymbol?: boolean;
    modifier?: string;
  } = {
    allowNegative: false,
    showName: true,
    showSymbol: false,
  }
) {
  const amount = BigNumber.isBigNumber(_amount)
    ? _amount
    : tokenValueToBN(_amount);

  const outputValue = config.allowNegative
    ? displayFullBN(amount, token.displayDecimals)
    : displayFullBN(amount.abs(), token.displayDecimals);

  const modifier = config.modifier || '';

  const name = config.showName ? token.name : '';

  const symbol = config.showSymbol ? token.symbol : '';

  return `${outputValue} ${modifier} ${name}${symbol}`;
}

/**
 * Display a BigNumber with abbreviations for large numbers.
 */
export function displayBN(
  bn: BigNumber,
  allowNegative: boolean = false
): string {
  if (bn === undefined || !(bn instanceof BigNumber)) return '0';
  if (bn.isLessThan(new BigNumber(0))) {
    return allowNegative ? `-${displayBN(bn.multipliedBy(-1))}` : '0';
  }
  if (bn.isEqualTo(0)) {
    return '0';
  }
  if (bn.isLessThanOrEqualTo(1e-8)) {
    return '<.00000001';
  }
  if (bn.isLessThanOrEqualTo(1e-3)) {
    return TrimBN(bn, 8).toFixed();
  }

  if (bn.isGreaterThanOrEqualTo(1e12)) {
    return `${TrimBN(bn.dividedBy(1e12), 4)}T`; /* Trillions */
  }
  if (bn.isGreaterThanOrEqualTo(1e9)) {
    return `${TrimBN(bn.dividedBy(1e9), 3)}B`; /* Billions */
  }
  if (bn.isGreaterThanOrEqualTo(1e8)) {
    return `${TrimBN(bn.dividedBy(1e6), 2)}M`; /* Millions */
  }
  if (bn.isGreaterThanOrEqualTo(1e6)) {
    return `${TrimBN(bn.dividedBy(1e6), 2)}M`; /* Millions */
  }
  if (bn.isGreaterThanOrEqualTo(1e3)) {
    return `${displayFullBN(bn, 0)}`; /* Small Thousands */
  }

  const decimals = bn.isGreaterThan(10) ? 2 : bn.isGreaterThan(1) ? 3 : 4;
  return TrimBN(bn, decimals).toFixed();
}

/**
 *
 */
export function smallDecimalPercent(bn: BigNumber) {
  if (bn.isLessThanOrEqualTo(1e-4)) return '<.0001';
  // if (bn.isLessThanOrEqualTo(1e-4)) return bn.toFixed(5);
  if (bn.isLessThanOrEqualTo(1e-3)) return bn.toFixed(4);
  return TrimBN(bn, 3).toFixed();
}

/**
 *
 */
type Numberish = BigNumber | TokenValue | number | string;

function toNumber(value: Numberish) {
  if (typeof value === 'string') return parseFloat(value);
  if (typeof value === 'number') return value;
  return value.toNumber();
}

const USDFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USDFormatterCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  compactDisplay: 'short',
});

export function displayUSD(
  _value: Numberish,
  /**
   * display in shorthand compact notation if above this value
   * ex: $1.123M     */
  compact?: number
) {
  const value = toNumber(_value);

  if (compact && value > compact) {
    return USDFormatterCompact.format(value);
  }

  return USDFormatter.format(value);
}

/**
 * Standard Bean price display: truncate with ROUND_FLOOR.
 *
 * 0.99995 => "0.9999"
 * 1.00006 => "1.0000"
 *
 * @param price Bean price
 * @param decimals number of decimals to display
 * @returns string; truncated Bean price
 */
export function displayBeanPrice(price: BigNumber, decimals: number = 4) {
  return price.dp(decimals, BigNumber.ROUND_FLOOR).toFixed(decimals);
}

export function displayStalk(
  stalk: BigNumber,
  decimals: number = STALK.displayDecimals
) {
  return stalk.lt(0.0001) ? '0' : displayFullBN(stalk, decimals);
}

export function displayPercentage(pct: BigNumber, decimals: number = 4) {
  return pct.lt(10 ** -decimals) ? '0%' : `${pct.toFixed(4)}%`;
}

// -------------------------
// Token Unit Conversions
// -------------------------

/**
 * Convert a "decimal amount" (decimal form) to "token amount" (integer form).
 * This is what's stored on chain.
 *
 * @param decimalAmt
 * @param decimals
 * @returns int
 */
export function toBaseUnitBN(
  decimalAmt: BigNumber.Value,
  decimals: BigNumber.Value
): BigNumber {
  const amt = new BigNumber(decimalAmt);
  const base = new BigNumber(10);
  const decimalsBN = new BigNumber(decimals);
  const digits = base.pow(decimalsBN);
  return amt.multipliedBy(digits).integerValue();
}

/**
 * Convert a "token amount" (integer form) to "decimal amount" (decimal form).
 * This is typically what's displayed to users within the application.
 *
 * @param tokenAmt BigNumber.Value
 * @param decimals BigNumber.Value
 * @returns BigNumber
 */
export function toTokenUnitsBN(
  tokenAmt: BigNumber.Value,
  decimals: BigNumber.Value
): BigNumber {
  const amt = new BigNumber(tokenAmt);
  const base = new BigNumber(10);
  const decimalsBN = new BigNumber(decimals);
  const digits = base.pow(decimalsBN);
  return amt.dividedBy(digits);
}

/**
 * Convert a "raw amount" (decimal form) to "token amount" (integer form).
 * This is what's stored on chain.
 *
 * @param decimalAmt
 * @param decimals
 * @returns string
 */
export function toStringBaseUnitBN(
  decimalAmt: BigNumber.Value,
  decimals: BigNumber.Value
): string {
  return toBaseUnitBN(decimalAmt, decimals).toFixed();
}

export function getTokenIndex(token: { symbol: string; address: string }) {
  if (token.symbol === 'ETH') return 'eth';
  return token.address;
}

export type TokenIsh = string | Token | LegacyToken | undefined;

export type TokenClassInstance = Token | LegacyToken;

/**
 * @param tk
 * returns true if token is instance of a Token from either UI or SDK classes
 */
export function isTokenInstance(tk: TokenIsh): tk is Token;
export function isTokenInstance(tk: TokenIsh): tk is LegacyToken;
export function isTokenInstance(tk: TokenIsh): boolean {
  return tk instanceof Token || tk instanceof LegacyToken;
}

/**
 * @param tk
 * returns true if token is instance of NativeToken from either UI or SDK classes
 */
export function isNativeToken(tk: TokenIsh): tk is LegacyNativeToken;
export function isNativeToken(tk: TokenIsh): tk is NativeToken;
export function isNativeToken(tk: TokenIsh): boolean {
  return tk instanceof LegacyNativeToken || tk instanceof NativeToken;
}

/**
 * @param tk
 * returns true if token is instance of Token from SDK
 */
export function isSdkToken(tk: TokenIsh): tk is Token {
  return tk instanceof Token;
}

/**
 * @param tk
 * returns true if token is instance of LegacyToken
 */
export function isLegacyToken(tk: TokenIsh): tk is LegacyToken {
  return tk instanceof LegacyToken;
}

export function symbolsEqual(a: TokenInstance, b: TokenInstance) {
  return stringsEqual(a.symbol, b.symbol);
}

/**
 * Compares two strings case-insensitively.
 * if either string is undefined, returns false.
 */
export function tokenIshEqual(
  a: string | Token | LegacyToken | undefined,
  b: string | Token | LegacyToken | undefined
): boolean {
  if (!exists(a) || !exists(b)) return false;
  const addressesEqual = stringsEqual(
    typeof a === 'string' ? a : a.address,
    typeof b === 'string' ? b : b.address
  );

  if (isTokenInstance(a) && isTokenInstance(b)) {
    return (
      ChainResolver.resolveToMainnetChainId(a.chainId) ===
        ChainResolver.resolveToMainnetChainId(b.chainId) && addressesEqual
    );
  }

  return addressesEqual;
}
/**
 * Used to convert an amount to string of the value stored on chain.
 * Created to help merge sdk & app functionality.
 */
export function stringifyTokenAmount(
  _amount: BigNumber | TokenValue,
  tokenOrDecimals: TokenInstance | number
) {
  const amount = tokenValueToBN(_amount);
  const decimals =
    typeof tokenOrDecimals === 'number'
      ? tokenOrDecimals
      : tokenOrDecimals.decimals;

  return toStringBaseUnitBN(amount, decimals);
}
