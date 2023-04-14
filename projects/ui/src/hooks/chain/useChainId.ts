import { useMemo } from 'react';
import { useNetwork } from 'wagmi';
import { SupportedChainId } from '~/constants/chains';

/**
 * Returns the current chainId, falling back to MAINNET
 * if one isn't provided by the wallet connector.
 * 
 * @returns SupportedChainId
 */
export default function useChainId() {
  const { chain } = useNetwork();
  return useMemo(
    () => chain?.id || SupportedChainId.MAINNET,
    [chain?.id]
  );
}
