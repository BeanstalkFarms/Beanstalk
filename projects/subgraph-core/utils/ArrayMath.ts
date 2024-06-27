import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

export function BigInt_sum(a: BigInt[]): BigInt {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    retval = retval.plus(a[i]);
  }
  return retval;
}

export function BigInt_max(a: BigInt[]): BigInt {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] > retval) {
      retval = a[i];
    }
  }
  return retval;
}

export function BigInt_min(a: BigInt[]): BigInt {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] < retval) {
      retval = a[i];
    }
  }
  return retval;
}

export function BigDecimal_sum(a: BigDecimal[]): BigDecimal {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    retval = retval.plus(a[i]);
  }
  return retval;
}

export function BigDecimal_max(a: BigDecimal[]): BigDecimal {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] > retval) {
      retval = a[i];
    }
  }
  return retval;
}

export function BigDecimal_min(a: BigDecimal[]): BigDecimal {
  let retval = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] < retval) {
      retval = a[i];
    }
  }
  return retval;
}
