import { useMemo } from 'react';
import { ChainResolver } from '@beanstalk/sdk-core';
import useChainId from './useChainId';

function useChainState() {
  const chainId = useChainId();

  return useMemo(
    () => ({
      isEthereum: ChainResolver.isL1Chain(chainId),
      isDev: ChainResolver.isTestnet(chainId),
      isArbitrum: ChainResolver.isL2Chain(chainId),
      fallbackChainId: ChainResolver.resolveToMainnetChainId(chainId),
      chainId,
    }),
    [chainId]
  );
}

export default useChainState;
