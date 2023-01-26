import { useContext, useMemo, useCallback } from 'react';
import { ERC20Token, NativeToken, Token, TokenValue } from '@beanstalk/sdk';
import {
  BEAN,
  ETH,
  BEAN_CRV3_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_CRV3,
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
} from '../../constants/tokens';
import { Token as TokenOld, Pool as PoolOld } from '~/classes';
import { AddressMap } from '~/constants';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';

const oldTokenMap = {
  [ETH[1].symbol]: ETH[1],
  [BEAN[1].symbol]: BEAN[1],
  [BEAN_CRV3_LP[1].symbol]: BEAN_CRV3_LP[1],
  [UNRIPE_BEAN[1].symbol]: UNRIPE_BEAN[1],
  [UNRIPE_BEAN_CRV3[1].symbol]: UNRIPE_BEAN_CRV3[1],
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

export default function useSdk() {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk) {
    throw new Error('Expected sdk to be used within BeanstalkSDK context');
  }
  return useMemo(() => sdk, [sdk]);
}

/**
 * copy of useTokenMap
 * temporary solution until we migrate everything to the SDK
 */
export function useToTokenMap<T extends Token>(
  list: T[] | Set<T>
): AddressMap<T> {
  return useMemo(
    () =>
      [...list].reduce<AddressMap<T>>((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {}),
    [list]
  );
}

export function getNewToOldToken(_token: Token) {
  const token = oldTokenMap[_token.symbol];
  if (!token) {
    throw new Error('Token could not found');
  }
  return token as TokenOld;
}

export function useSdkMiddleware() {
  const sdk = useSdk();

  const getSdkToken = useCallback(
    (_token: TokenOld) => {
      const token = sdk.tokens.findByAddress(_token.address);
      return token as ERC20Token | NativeToken;
    },
    [sdk.tokens]
  );

  const getSdkPool = useCallback(
    (_pool: PoolOld | null) => {
      if (!_pool) return null;
      return [...sdk.pools.pools].find((p) => p.address === _pool.address);
    },
    [sdk.pools.pools]
  );

  return {
    getSdkPool,
    getSdkToken,
  };
}

export function createLocalOnlyStep(name: string, amount: TokenValue) {
  const step = async () => ({
    name: name,
    amountOut: amount.toBigNumber(),
    prepare: () => ({
      target: '',
      callData: '',
    }),
    decode: () => undefined,
    decodeResult: () => undefined,
  });

  return step;
}
