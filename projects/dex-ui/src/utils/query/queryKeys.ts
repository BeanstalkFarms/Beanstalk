export const queryKeys = {
  erc20TokenWithAddress: (address: string) => ["token", "erc20", address],
  tokenMetadata: (address: string) => ["token", "metadata", address],
  tokenAllowance: (tokenAddress: string | undefined, spender: string) => [
    "token",
    "allowance",
    tokenAddress || "invalid",
    spender
  ],
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
  tokenBalance: (address: string | undefined) => [
    "token",
    "balance",
    "external",
    address || "invalid"
  ],
  tokenBalanceInternal: (address: string | undefined) => [
    "token",
    "balance",
    "internal",
    address || "invalid"
  ],

  siloBalancesAll: ["silo", "balance"],
  siloBalance: (address: string) => ["silo", "balance", address],
  siloBalanceMany: (addresses: string[]) => ["silo", "balance", ...addresses]
} as const;
