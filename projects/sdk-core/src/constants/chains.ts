/**
 * List of supported chains
 */
export enum ChainId {
  MAINNET = 1,
  ANVIL1 = 1007,
  LOCALHOST = 1337,
  TESTNET = 31337
}

/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
export const TESTNET_CHAINS = new Set([ChainId.ANVIL1, ChainId.LOCALHOST, ChainId.TESTNET]);
