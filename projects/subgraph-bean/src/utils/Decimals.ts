import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const DEFAULT_DECIMALS = 6;

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const BI_6 = BigInt.fromI32(6);
export const BI_10 = BigInt.fromI32(10);
export const BI_18 = BigInt.fromI32(18);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
export const BD_18 = BigDecimal.fromString("18");

export function pow(base: BigDecimal, exponent: number): BigDecimal {
  let result = base;

  if (exponent == 0) {
    return BigDecimal.fromString("1");
  }

  for (let i = 2; i <= exponent; i++) {
    result = result.times(base);
  }

  return result;
}

export function toDecimal(value: BigInt, decimals: number = DEFAULT_DECIMALS): BigDecimal {
  let precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();

  return value.divDecimal(precision);
}

export function toBigInt(value: BigDecimal, decimals: number = DEFAULT_DECIMALS): BigInt {
  let precision = 10 * decimals;
  return BigInt.fromString(value.times(BigDecimal.fromString(precision.toString())).truncate(0).toString());
}
