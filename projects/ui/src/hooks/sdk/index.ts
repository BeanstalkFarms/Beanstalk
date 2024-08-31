import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';
import {
  BEAN,
  ETH,
  BEAN_CRV3_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WSTETH,
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
  WSTETH,
  BEAN_WSTETH_WELL_LP,
  SILO_WHITELIST,
  BEAN_USDC_WELL_LP,
  BEAN_USDT_WELL_LP,
  BEAN_WBTC_WELL_LP,
  BEAN_WEETH_WELL_LP,
  WBTC,
  WEETH,
} from '~/constants/tokens';
import { Token as TokenOld } from '~/classes';
import { ChainConstant, SupportedChainId } from '~/constants';
import useGetChainToken from '../chain/useGetChainToken';

export default function useSdk() {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk) {
    throw new Error('Expected sdk to be used within BeanstalkSDK context');
  }
  return useMemo(() => sdk, [sdk]);
}

const i = SupportedChainId.ARBITRUM;

const oldTokenMap = {
  [ETH[i].symbol]: ETH,
  [BEAN[i].symbol]: BEAN,
  [UNRIPE_BEAN[i].symbol]: UNRIPE_BEAN,
  [UNRIPE_BEAN_WSTETH[i].symbol]: UNRIPE_BEAN_WSTETH,
  [WETH[i].symbol]: WETH,
  [DAI[i].symbol]: DAI,
  [USDC[i].symbol]: USDC,
  [USDT[i].symbol]: USDT,
  [WSTETH[i].symbol]: WSTETH,
  [WEETH[i].symbol]: WEETH,
  [WBTC[i].symbol]: WBTC,
  [BEAN_ETH_WELL_LP[i].symbol]: BEAN_ETH_WELL_LP,
  [BEAN_WSTETH_WELL_LP[i].symbol]: BEAN_WSTETH_WELL_LP,
  [BEAN_WEETH_WELL_LP[i].symbol]: BEAN_WEETH_WELL_LP,
  [BEAN_WBTC_WELL_LP[i].symbol]: BEAN_WBTC_WELL_LP,
  [BEAN_USDC_WELL_LP[i].symbol]: BEAN_USDC_WELL_LP,
  [BEAN_USDT_WELL_LP[i].symbol]: BEAN_USDT_WELL_LP,
  [STALK.symbol]: STALK,
  [SEEDS.symbol]: SEEDS,
  [PODS.symbol]: PODS,
  [SPROUTS.symbol]: SPROUTS,
  [RINSABLE_SPROUTS.symbol]: RINSABLE_SPROUTS,
  [BEAN_CRV3_LP[1].symbol]: BEAN_CRV3_LP[1],
  [CRV3[1].symbol]: CRV3[1],
  [BEAN_ETH_UNIV2_LP[1].symbol]: BEAN_ETH_UNIV2_LP[1],
  [BEAN_LUSD_LP[1].symbol]: BEAN_LUSD_LP[1],
  [LUSD[1].symbol]: LUSD[1],
} as const;

export function getNewToOldToken(_token: Token) {
  const mayToken = oldTokenMap[_token.symbol];
  if (!mayToken) {
    throw new Error(`getNewToOldToken: ${_token.symbol} could not found`);
  }

  if (mayToken instanceof TokenOld) return mayToken;

  const token = (mayToken as ChainConstant<TokenOld>)[_token.chainId];
  if (!token) {
    throw new Error(`getNewToOldToken: ${_token.symbol} could not found`);
  }
  return token;
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
