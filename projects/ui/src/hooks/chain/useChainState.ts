import { L1_CHAIN_IDS, SupportedChainId } from '~/constants/chains';
import { useMemo } from 'react';
import useChainId from './useChainId';

const SUPPORTED_DEV_CHAINS = new Set<SupportedChainId>([
  SupportedChainId.LOCALHOST,
  SupportedChainId.LOCALHOST_MAINNET,
  SupportedChainId.TESTNET,
]);

const SUPPORTED_L1_CHAINS = new Set<SupportedChainId>(L1_CHAIN_IDS);

const SUPPORTED_ARB_CHAINS = new Set<SupportedChainId>([
  SupportedChainId.ARBITRUM,
  SupportedChainId.LOCALHOST,
]);

function useChainState() {
  const chainId = useChainId();

  return useMemo(() => {
    const isEthereum = SUPPORTED_L1_CHAINS.has(chainId);
    const isDev = SUPPORTED_DEV_CHAINS.has(chainId);
    const isArbitrum = SUPPORTED_ARB_CHAINS.has(chainId);

    const fallbackChainId = isEthereum
      ? SupportedChainId.MAINNET
      : SupportedChainId.ARBITRUM;

    return { isEthereum, isDev, isArbitrum, chainId, fallbackChainId };
  }, [chainId]);
}

export default useChainState;
