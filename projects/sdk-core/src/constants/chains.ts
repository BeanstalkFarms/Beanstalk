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

export type TestnetChainId =
  | ChainId.ANVIL1
  | ChainId.LOCALHOST
  | ChainId.TESTNET
  | ChainId.LOCALHOST_ETH;

export type MainnetChainId = ChainId.ETH_MAINNET | ChainId.ARBITRUM_MAINNET;

/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 *
 * - ANVIL1
 * - LOCALHOST
 * - TESTNET
 * - LOCALHOST_ETH
 */
export const TESTNET_CHAINS: Readonly<Set<ChainId>> = new Set([
  ChainId.ANVIL1,
  ChainId.LOCALHOST,
  ChainId.TESTNET,
  ChainId.LOCALHOST_ETH
]);

/**
 * Mainnet chains
 *
 * - ETH_MAINNET
 * - ARBITRUM_MAINNET
 */
export const MAINNET_CHAINS: Readonly<Set<ChainId>> = new Set([
  ChainId.ETH_MAINNET,
  ChainId.ARBITRUM_MAINNET
]);
