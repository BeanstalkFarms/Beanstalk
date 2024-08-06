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

export function BigDecimal_indexOfMin(a: BigDecimal[]): u32 {
  let retval = 0;
  let min = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] < min) {
      retval = i;
      min = a[i];
    }
  }
  return retval;
}

export function f64_sum(arr: f64[]): f64 {
  let sum: f64 = 0.0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

export function f64_max(arr: f64[]): f64 {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}
