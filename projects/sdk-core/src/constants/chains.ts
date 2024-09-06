/**
 * List of supported chains
 */
export enum ChainId {
  ETH_MAINNET = 1,
  ARBITRUM_MAINNET = 42161,
  LOCALHOST = 1337,
  LOCALHOST_ETH = 1338,
  ANVIL1 = 1007,
  TESTNET = 31337
}

/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
export const TESTNET_CHAINS = new Set([
  ChainId.ANVIL1,
  ChainId.LOCALHOST,
  ChainId.TESTNET,
  ChainId.LOCALHOST_ETH
]);