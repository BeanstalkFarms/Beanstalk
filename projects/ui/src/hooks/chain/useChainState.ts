import { useMemo } from 'react';
import { ChainResolver } from '@beanstalk/sdk-core';
import { SupportedChainId } from '~/constants';
import useChainId from './useChainId';

function useChainState() {
  const chainId = useChainId();

  return useMemo(
    () => ({
      isEthereum: ChainResolver.isL1Chain(chainId),
      isTestnet: ChainResolver.isTestnet(chainId),
      isArbitrum: ChainResolver.isL2Chain(chainId),
      fallbackChainId: ChainResolver.resolveToMainnetChainId(chainId),
      chainId,
      isArbMainnet: chainId === SupportedChainId.ARBITRUM_MAINNET,
    }),
    [chainId]
  );
}

export default useChainState;
