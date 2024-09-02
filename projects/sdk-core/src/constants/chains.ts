/**
 * List of supported chains
 */
export enum ChainId {
  MAINNET = 1,
  ARBITRUM = 42161,
  ANVIL1 = 1007,
  TESTNET = 31337,
  LOCALHOST = 1337,
  LOCALHOST_MAINNET = 1338
}

/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
export const TESTNET_CHAINS = new Set([
  ChainId.ANVIL1,
  ChainId.LOCALHOST,
  ChainId.TESTNET,
  ChainId.LOCALHOST_MAINNET
]);
