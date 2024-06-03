import { ethers } from "ethers";

export function exists<T>(value: T | undefined | null): value is NonNullable<T> {
  return value !== undefined && value !== null;
}

export function existsNot(value: any): value is undefined | null {
  return !exists(value);
}

/**
 * @param value
 * @returns boolean
 *
 * returns whether or not the value is convertible to bytes.
 */
export function isConvertibleToBytes(value: string | number | undefined) {
  if (!value) return false;
  if (typeof value === "number" && value < 0) return false;

  try {
    if (value === "0x") return true;
    ethers.BigNumber.from(value);
    return true;
  } catch (e) {
    return false;
  }
}
