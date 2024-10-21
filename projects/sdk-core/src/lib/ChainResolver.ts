import {
  ChainId,
  MAINNET_CHAINS,
  MainnetChainId,
  TESTNET_CHAINS,
  TestnetChainId
} from "src/constants/chains";

/**
 * ChainResolver provides utility methods for working with network chainIds.
 * It helps resolve testnet chainIds to their mainnet equivalents and determine chain types.
 */
export class ChainResolver {
  // The default mainnet chain ID, initially set to Arbitrum mainnet
  static defaultChainId: MainnetChainId = ChainId.ARBITRUM_MAINNET;

  // Mapping of testnet chain IDs to their mainnet equivalents
  private static readonly fallbackChainIds: Record<TestnetChainId, MainnetChainId> = {
    [ChainId.LOCALHOST_ETH]: ChainId.ETH_MAINNET,
    [ChainId.LOCALHOST]: ChainId.ARBITRUM_MAINNET,
    [ChainId.ANVIL1]: ChainId.ETH_MAINNET,
    [ChainId.TESTNET]: ChainResolver.defaultChainId
  };

  /**
   * Validates if a given chainId is supported by the system.
   * @param chainId - The chainId to validate.
   * @throws Error if the chainId is not supported.
   */
  static validateChainId(chainId: ChainId) {
    if (!ChainId[chainId]) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }
  }

  /**
   * Sets a new default mainnet chainId.
   * This can be useful when the system needs to prioritize a different mainnet.
   * @param chainId - The new default mainnet chainId.
   * @throws Error if the provided chainId is not a mainnet chain.
   */
  static setDefaultChainId(chainId: MainnetChainId) {
    ChainResolver.validateChainId(chainId);

    if (!ChainResolver.isMainnetChain(chainId)) {
      throw new Error(`Chain ID ${chainId} is not a mainnet chainId`);
    }

    ChainResolver.defaultChainId = chainId;
  }

  /**
   * Resolves any chainId to its mainnet equivalent.
   * If the input is already a mainnet chainId, it's returned unchanged.
   * @param chainId - The chainId to resolve.
   * @returns The equivalent mainnet chainId.
   * @throws Error if no mainnet equivalent is found for the given chainId.
   */
  static resolveToMainnetChainId(chainId: ChainId) {
    ChainResolver.validateChainId(chainId);

    if (ChainResolver.isMainnetChain(chainId)) {
      return chainId;
    }

    const mainnetChainId = ChainResolver.fallbackChainIds[chainId as TestnetChainId];
    if (!mainnetChainId) {
      throw new Error(`No mainnet equivalent found for chain ID ${chainId}`);
    }

    return mainnetChainId;
  }

  /**
   * Determines if a given chainId represents a testnet ChainId.
   * @param chainId - The chainId to check.
   * @returns True if the chainId is a testnet, false otherwise.
   */
  static isTestnet(chainId: ChainId): chainId is TestnetChainId {
    ChainResolver.validateChainId(chainId);
    return TESTNET_CHAINS.has(chainId);
  }

  /**
   * Determines if a given chainId represents a mainnet ChainId.
   * @param chainId - The chainId to check.
   * @returns True if the chainId is a mainnet, false otherwise.
   */
  static isMainnetChain(chainId: ChainId): chainId is MainnetChainId {
    ChainResolver.validateChainId(chainId);
    return MAINNET_CHAINS.has(chainId);
  }

  /**
   * Checks if a chainId represents an L1 (Layer 1) network.
   * Currently, this method considers Ethereum mainnet as the only L1.
   * @param chainId - The chainId to check.
   * @returns True if the chainId represents an L1 network, false otherwise.
   */
  static isL1Chain(chainId: ChainId) {
    return ChainResolver.resolveToMainnetChainId(chainId) === ChainId.ETH_MAINNET;
  }

  /**
   * Checks if a chainId represents an L2 (Layer 2) network.
   * Currently, this method considers Arbitrum as the only L2.
   * @param chainId - The chainId to check.
   * @returns True if the chainId represents an L2 network, false otherwise.
   */
  static isL2Chain(chainId: ChainId) {
    return ChainResolver.resolveToMainnetChainId(chainId) === ChainId.ARBITRUM_MAINNET;
  }
}
