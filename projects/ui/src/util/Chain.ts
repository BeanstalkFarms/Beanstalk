import { TESTNET_CHAINS, SupportedChainId } from '~/constants';

/// Convention: 
/// "chain constant" = a value that is constant for a given chain.
/// May or may not be constant across chains. For example, the 
/// BEAN token address is typically the same on every testnet,
/// but the USDC token address is not. This requires manual configuration.

export type ChainConstant = { [chainId: number] : any };

/**
 * Return a constant from a supplied ChainConstant map, with fallback logic.
 */
export function getChainConstant<T extends ChainConstant>(map: T, chainId?: SupportedChainId) : T[keyof T] {
  // If no chain available, use the value for MAINNET.
  // This allows "fallback to Mainnet" behavior when a
  // wallet isn't connected (and thus there is no chainId).
  if (!chainId || !SupportedChainId[chainId]) {
    return map[SupportedChainId.MAINNET];
  }
  // Use TESTNET-specific value if available, otherwise
  // fall back to MAINNET. This allows for forking.
  // Example: if we fork mainnet but don't change any
  // token addresses, this falls back to mainnet addresses.
  if (TESTNET_CHAINS.has(chainId)) {
    return map[chainId] || map[SupportedChainId.MAINNET];
  }
  // Return value for the active chainId.
  return map[chainId];
}
