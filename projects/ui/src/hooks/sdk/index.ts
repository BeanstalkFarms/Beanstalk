import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';
import { SILO_WHITELIST } from '~/constants/tokens';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { ChainResolver } from '@beanstalk/sdk-core';
import useChainState from '../chain/useChainState';

export default function useSdk() {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk) {
    throw new Error('Expected sdk to be used within BeanstalkSDK context');
  }
  return useMemo(() => sdk, [sdk]);
}

export const useRefreshSeeds = () => {
  const getChainToken = useGetChainToken();

  return useCallback(
    async (sdk: BeanstalkSDK) => {
      if (ChainResolver.isL1Chain(sdk.chainId)) {
        return;
      }
      await sdk.refresh();
      // Copy the seed values from sdk tokens to ui tokens

      for (const chainToken of SILO_WHITELIST) {
        const token = getChainToken(chainToken);
        // console.log('chainToken: ', chainToken);
        const seeds = sdk.tokens.findBySymbol(token.symbol)?.rewards?.seeds;
        if (!seeds) {
          console.log(`SDK token ${token.symbol} did not have any seeds set`);
          throw new Error(`No seeds set for ${token.symbol}`);
        }
        if (token && token?.rewards) {
          token.rewards.seeds = parseFloat(seeds.toHuman());
        }
      }
    },
    [getChainToken]
  );
};

export const useUpdateSdkPoolTokenIndicies = () => {
  const updatePoolIndicies = useCallback(async (sdk: BeanstalkSDK) => {
    await Promise.all(
      sdk.pools.getWells().map((well) => well.updateTokenIndexes())
    );
  }, []);

  return updatePoolIndicies;
};

export const useDynamicSeeds = (
  sdk: BeanstalkSDK,
  allowRun: boolean = true
) => {
  const [ready, setReady] = useState(false);
  const refreshSeeds = useRefreshSeeds();
  const updatePoolIndicies = useUpdateSdkPoolTokenIndicies();
  const { isArbitrum } = useChainState();

  useEffect(() => {
    if (!allowRun) return;
    const load = async () => {
      await Promise.all([
        refreshSeeds(sdk),
        // fix me - put me somewhere else?
        updatePoolIndicies(sdk),
      ]);
      setReady(true);
    };

    load();
  }, [refreshSeeds, updatePoolIndicies, sdk, allowRun, isArbitrum]);

  return ready;
};
