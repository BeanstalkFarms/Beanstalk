import { Address, ChainId } from "@beanstalk/sdk-core";

const NON_DEV_CHAIN_IDS = new Set<ChainId>([ChainId.ARBITRUM, ChainId.MAINNET]);

/**
 *
 */
export function getChainIdOrFallbackChainId(_chainId: ChainId): ChainId.ARBITRUM | ChainId.MAINNET {
  let chainId = _chainId;
  if (NON_DEV_CHAIN_IDS.has(chainId)) {
    return chainId as ChainId.ARBITRUM | ChainId.MAINNET;
  }

  const fallback = Address.getFallbackChainId(_chainId);
  if (fallback !== ChainId.ARBITRUM && fallback !== ChainId.MAINNET) {
    throw new Error(`Expected fallback chain ID to be ARBITRUM or MAINNET, got: ${fallback}`);
  }

  return fallback;
}

export function isArbitrum(_chainId: ChainId): boolean {
  const chainId = getChainIdOrFallbackChainId(_chainId);
  return chainId === ChainId.ARBITRUM;
}

export function isEthMainnet(_chainId: ChainId): boolean {
  const chainId = getChainIdOrFallbackChainId(_chainId);
  return chainId === ChainId.MAINNET;
}
