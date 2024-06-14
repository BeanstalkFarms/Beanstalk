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
  wellFunctionValid: (address: string, data: string) => ["wellFunction", "isValid", address, data]
} as const;
