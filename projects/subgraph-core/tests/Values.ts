import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

/* Shorthand functions for constructing some common value types */

export function beans_BI(b: number): BigInt {
  return BigInt.fromI32(<i32>b).times(BigInt.fromI32(10).pow(6));
}

export function podlineMil_BI(m: number): BigInt {
  return BigInt.fromI32(<i32>m).times(BigInt.fromI32(10).pow(12));
}
