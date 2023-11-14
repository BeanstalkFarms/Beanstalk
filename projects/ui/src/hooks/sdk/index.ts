import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';
import {
  BEAN,
  ETH,
  BEAN_CRV3_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WETH,
  WETH,
  CRV3,
  DAI,
  USDC,
  USDT,
  STALK,
  SEEDS,
  PODS,
  SPROUTS,
  LUSD,
  BEAN_LUSD_LP,
  BEAN_ETH_UNIV2_LP,
  RINSABLE_SPROUTS,
  BEAN_ETH_WELL_LP,
  SILO_WHITELIST,
} from '~/constants/tokens';
import { Token as TokenOld } from '~/classes';
import useGetChainToken from '../chain/useGetChainToken';

export default function useSdk() {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk) {
    throw new Error('Expected sdk to be used within BeanstalkSDK context');
  }
  return useMemo(() => sdk, [sdk]);
}

const oldTokenMap = {
  [ETH[1].symbol]: ETH[1],
  [BEAN[1].symbol]: BEAN[1],
  [BEAN_CRV3_LP[1].symbol]: BEAN_CRV3_LP[1],
  [BEAN_ETH_WELL_LP[1].symbol]: BEAN_ETH_WELL_LP[1],
  [UNRIPE_BEAN[1].symbol]: UNRIPE_BEAN[1],
  [UNRIPE_BEAN_WETH[1].symbol]: UNRIPE_BEAN_WETH[1],
  [WETH[1].symbol]: WETH[1],
  [CRV3[1].symbol]: CRV3[1],
  [DAI[1].symbol]: DAI[1],
  [USDC[1].symbol]: USDC[1],
  [USDT[1].symbol]: USDT[1],
  [LUSD[1].symbol]: LUSD[1],
  [STALK.symbol]: STALK,
  [SEEDS.symbol]: SEEDS,
  [PODS.symbol]: PODS,
  [SPROUTS.symbol]: SPROUTS,
  [RINSABLE_SPROUTS.symbol]: RINSABLE_SPROUTS,
  [BEAN_ETH_UNIV2_LP[1].symbol]: BEAN_ETH_UNIV2_LP[1],
  [BEAN_LUSD_LP[1].symbol]: BEAN_LUSD_LP[1],
};

export function getNewToOldToken(_token: Token) {
  const token = oldTokenMap[_token.symbol];
  if (!token) {
    throw new Error('Token could not found');
  }
  return token as TokenOld;
}

export const useRefreshSeeds = () => {
  const getChainToken = useGetChainToken();
  return useCallback(
    async (sdk: BeanstalkSDK) => {
      await sdk.refresh();
      // Copy the seed values from sdk tokens to ui tokens

      for await (const chainToken of SILO_WHITELIST) {
        const token = getChainToken(chainToken);
        const seeds = sdk.tokens.findBySymbol(token.symbol)?.rewards?.seeds;
        if (!seeds) {
          console.log(`SDK token ${token.symbol} did not have any seeds set`);
          throw new Error(`No seeds set for ${token.symbol}`);
        }
        token!.rewards!.seeds = parseFloat(seeds.toHuman());
      }
    },
    [getChainToken]
  );
};

export const useDynamicSeeds = (sdk: BeanstalkSDK) => {
  const [ready, setReady] = useState(false);
  const refreshSeeds = useRefreshSeeds();
  useEffect(() => {
    const load = async () => {
      await refreshSeeds(sdk);
      setReady(true);
    };

    load();
  }, [refreshSeeds, sdk]);

  return ready;
};
