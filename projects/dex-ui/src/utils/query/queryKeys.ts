export const queryKeys = {
  erc20TokenWithAddress: (address: string) => ["token", "erc20", address],
  tokenMetadata: (address: string) => ["token", "metadata", address]
} as const;
