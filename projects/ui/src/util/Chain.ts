import { Address } from '@beanstalk/sdk-core';
import { TESTNET_CHAINS, SupportedChainId } from '~/constants';

/// Convention:
/// "chain constant" = a value that is constant for a given chain.
/// May or may not be constant across chains. For example, the
/// BEAN token address is typically the same on every testnet,
/// but the USDC token address is not. This requires manual configuration.

export type ChainConstant = { [chainId: number]: any };

/**
 * Return a constant from a supplied ChainConstant map, with fallback logic.
 */
export function getChainConstant<T extends ChainConstant>(
  map: T,
  chainId?: SupportedChainId
): T[keyof T] {
  // If no chain available, use the default chainId used in the sdk.
  // This allows "fallback to Arbitrum" behavior when a
  // wallet isn't connected (and thus there is no chainId).
  // Default chainId is currently set to arbitrum.
  if (!chainId || !SupportedChainId[chainId]) {
    return map[Address.defaultChainId];
  }
  // Use TESTNET-specific value if available, otherwise
  // fall back to arbitrum / default chainId. This allows for forking.
  // Example: if we fork arbitrum mainnet but don't change any
  // token addresses, this falls back to arbitrum mainnet addresses.
  if (TESTNET_CHAINS.has(chainId)) {
    const fallbackChainId = Address.getFallbackChainId(chainId);
    return map[chainId] || map[fallbackChainId] || map[Address.defaultChainId];
  }
  // Return value for the active chainId.
  return map[chainId];
}
