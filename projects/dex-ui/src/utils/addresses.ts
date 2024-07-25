/// All addresses are in lowercase for consistency

import { ethers } from "ethers";
import { AddressMap } from "src/types";

/// Well LP Tokens
export const BEANETH_ADDRESS = "0xbea0e11282e2bb5893bece110cf199501e872bad";

/// Pump Addresses
export const MULTI_FLOW_PUMP_ADDRESS = "0xBA51AaaAa95bA1d5efB3cB1A3f50a09165315A17";

/// Well Function Addresses
export const CONSTANT_PRODUCT_2_ADDRESS = "0xba510c20fd2c52e4cb0d23cfc3ccd092f9165a6e";

// Well Implementation
export const WELL_DOT_SOL_ADDRESS = "0xba510e11eeb387fad877812108a3406ca3f43a4b";

// ---------- METHODS ----------

export const getIsValidEthereumAddress = (
  address: string | undefined,
  enforce0Suffix = true
): boolean => {
  if (!address) return false;
  if (enforce0Suffix && !address.startsWith("0x")) return false;
  return ethers.utils.isAddress(address ?? "");
};

/**
 * Converts an object or array of objects with an address property to a map of address to object.
 */
export const toAddressMap = <T extends { address: string }>(
  hasAddress: T | T[],
  options?: {
    keyLowercase?: boolean;
  }
) => {
  const arr = Array.isArray(hasAddress) ? hasAddress : [hasAddress];

  return arr.reduce<AddressMap<T>>((prev, curr) => {
    const key = options?.keyLowercase ? curr.address.toLowerCase() : curr.address;
    prev[key] = curr;
    return prev;
  }, {});
};