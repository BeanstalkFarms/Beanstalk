export const queryKeys = {
  erc20TokenWithAddress: (address: string) => ["token", "erc20", address],
  tokenMetadata: (address: string) => ["token", "metadata", address],
  tokenAllowance: (tokenAddress: string | undefined, spender: string) => [
    "token",
    "allowance",
    tokenAddress || "invalid",
    spender
  ],

  // wells
  wellImplementations: (addresses: string[]) => ["wells", "implementations", addresses],

  // well Function
  wellFunctionValid: (address: string, data: string) => ["wellFunction", "isValid", address, data],
  wellFunctionNames: (addresses: string[] | undefined) => ["wellFunctions", "names", addresses],

  // prices
  tokenPricesAll: ["prices", "token"],
  tokenPrices: (address: string[]) => ["prices", "token", ...address],
  lpTokenPrices: (addresses: string[]) => ["prices", "lp-token", ...addresses],

  // token balance
  tokenBalancesAll: ["token", "balance"],
  tokenBalance: (symbol: string | undefined) => ["token", "balance", symbol || "invalid"]
} as const;
