import { Address, ChainId } from "@beanstalk/sdk-core";

const NON_DEV_CHAIN_IDS = new Set<ChainId>([ChainId.ARBITRUM_MAINNET, ChainId.ETH_MAINNET]);

/**
 *
 */
export function getChainIdOrFallbackChainId(
  _chainId: ChainId
): ChainId.ARBITRUM_MAINNET | ChainId.ETH_MAINNET {
  let chainId = _chainId;
  if (NON_DEV_CHAIN_IDS.has(chainId)) {
    return chainId as ChainId.ARBITRUM_MAINNET | ChainId.ETH_MAINNET;
  }

  const fallback = Address.getFallbackChainId(_chainId);
  if (fallback !== ChainId.ARBITRUM_MAINNET && fallback !== ChainId.ETH_MAINNET) {
    throw new Error(`Expected fallback chain ID to be ARBITRUM or MAINNET, got: ${fallback}`);
  }

  return fallback;
}

export function isArbitrum(_chainId: ChainId): boolean {
  const chainId = getChainIdOrFallbackChainId(_chainId);
  return chainId === ChainId.ARBITRUM_MAINNET;
}

export function isEthMainnet(_chainId: ChainId): boolean {
  const chainId = getChainIdOrFallbackChainId(_chainId);
  return chainId === ChainId.ETH_MAINNET;
}