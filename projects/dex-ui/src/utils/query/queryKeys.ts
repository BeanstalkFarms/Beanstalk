export const queryKeys = {
  erc20TokenWithAddress: (address: string) => ["token", "erc20", address],
  tokenMetadata: (address: string) => ["token", "metadata", address],
  tokenAllowance: (tokenAddress: string | undefined, spender: string) => [
    "token",
    "allowance",
    tokenAddress || "invalid",
    spender
  ],
  lpSummary: (lpAddresses: string[]) => ["token", "lpSummary", ...lpAddresses],
  lpSummaryAll: ["token", "lpSummary"],

  // wells
  wellImplementations: (addresses: string[]) => ["wells", "implementations", addresses],

  // well Function
  wellFunctionValid: (address: string, data: string) => ["wellFunction", "isValid", address, data],
  wellFunctionNames: (addresses: string[] | undefined) => ["wellFunctions", "names", addresses],

  // prices
  tokenPricesAll: ["prices", "token"],
  tokenPrices: (symbols: string[]) => ["prices", "token", ...symbols],
  lpTokenPrices: (addresses: string[]) => ["prices", "lp-token", ...addresses],

  // token balance
  tokenBalancesAll: ["token", "balance"],
  tokenBalance: (symbol: string | undefined) => ["token", "balance", "external", symbol || "invalid"],
  tokenBalanceInternal: (symbol: string | undefined) => ["token", "balance", "internal", symbol || "invalid"],

  siloBalancesAll: ["silo", "balance"],
  siloBalance: (symbol: string) => ["silo", "balance", symbol],
  siloBalanceMany: (symbols: string[]) => ["silo", "balance", ...symbols],
} as const;

