/// All addresses are in lowercase for consistency

import { ethers } from "ethers";

/// Well LP Tokens
export const BEANETH_ADDRESS = "0xbea0e11282e2bb5893bece110cf199501e872bad";

/// Pump Addresses
export const MULTI_FLOW_PUMP_ADDRESS = "0xba510f10e3095b83a0f33aa9ad2544e22570a87c";

/// Well Function Addresses
export const CONSTANT_PRODUCT_2_ADDRESS = "0xba510c20fd2c52e4cb0d23cfc3ccd092f9165a6e";

// Well Implementation
export const WELL_DOT_SOL_ADDRESS = "0xBA510e11eEb387fad877812108a3406CA3f43a4B".toLowerCase();


export const getIsValidEthereumAddress = (address: string | undefined): boolean => {
  if (!address) return false;
  return ethers.utils.isAddress(address ?? "");
};
