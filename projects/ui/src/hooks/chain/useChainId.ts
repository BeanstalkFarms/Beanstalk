import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { SupportedChainId } from '~/constants/chains';

/**
 * Returns the current chainId, falling back to MAINNET
 * if one isn't provided by the wallet connector.
 *
 * @returns SupportedChainId
 */
export default function useChainId() {
  const { chain } = useAccount();
  return useMemo(() => chain?.id || SupportedChainId.MAINNET, [chain?.id]);
}
