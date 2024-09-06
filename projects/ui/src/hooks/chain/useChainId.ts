import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { SupportedChainId } from '~/constants';

/**
 * Returns the current chainId, falling back to MAINNET
 * if one isn't provided by the wallet connector.
 *
 * @returns SupportedChainId
 */

const defaultChainId = import.meta.env.DEV
  ? SupportedChainId.LOCALHOST
  : SupportedChainId.ARBITRUM_MAINNET;

export default function useChainId() {
  const { chain } = useAccount();
  return useMemo(() => chain?.id || defaultChainId, [chain?.id]);
}
