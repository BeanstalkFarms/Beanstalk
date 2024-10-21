/* eslint-disable react-hooks/exhaustive-deps */

import { DependencyList, EffectCallback, useEffect, useMemo } from 'react';

import { ChainResolver } from '@beanstalk/sdk-core';
import useSdk from '~/hooks/sdk';


/**
 * useL2OnlyEffect
 *
 * useEffect that only runs when the chainId in BeanstalkSDK is an L2 chain.
 * It will still re-run if the chainId changes from L2 local & mainnet.
 */
function useL2OnlyEffect(
  effect: EffectCallback,
  deps: DependencyList,
): void {
  const sdk = useSdk();
  const isL2 = ChainResolver.isL2Chain(sdk.chainId);

  const effectDependencies: DependencyList = useMemo(
    () => [sdk.chainId, ...deps],
    [sdk.chainId, ...deps]
  );

  useEffect(() => {
    if (!isL2) return;

    const cleanupEffect = effect();

    return () => {
      if (typeof cleanupEffect === 'function') {
        cleanupEffect();
      }
    };
  }, effectDependencies);
}

export default useL2OnlyEffect;