import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';
import { SILO_WHITELIST } from '~/constants/tokens';
import useGetChainToken from '~/hooks/chain/useGetChainToken';

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

export const useDynamicSeeds = (
  sdk: BeanstalkSDK,
  allowRun: boolean = true
) => {
  const [ready, setReady] = useState(false);
  const refreshSeeds = useRefreshSeeds();

  useEffect(() => {
    if (!allowRun) return;
    const load = async () => {
      await refreshSeeds(sdk);
      setReady(true);
    };

    load();
  }, [refreshSeeds, sdk, allowRun]);

  return ready;
};
