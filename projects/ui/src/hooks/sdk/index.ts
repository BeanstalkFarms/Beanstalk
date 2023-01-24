import { useContext, useMemo, useCallback } from 'react';
import { BeanstalkSDK, ERC20Token, FarmFromMode, FarmToMode, NativeToken, Token } from '@beanstalk/sdk';
import { Token as TokenOld, Pool as PoolOld } from '~/classes';
import { AddressMap } from '~/constants';
import { BeanstalkSDKContext } from '~/components/App/SdkProvider';

export default function useSdk() {
  const sdk = useContext(BeanstalkSDKContext);
  if (!sdk) {
    throw new Error('Expected sdk to be used within BeanstalkSDK context');
  }
  return useMemo(() => sdk, [sdk]);
}

export type SDKTokenList = {
  unripeTokens: BeanstalkSDK['tokens']['unripeTokens'];
  unripeUnderlyingTokens: BeanstalkSDK['tokens']['unripeUnderlyingTokens'];
  siloWhitelist: BeanstalkSDK['tokens']['siloWhitelist'];
  erc20Tokens: BeanstalkSDK['tokens']['erc20Tokens'];
  balanceTokens: BeanstalkSDK['tokens']['balanceTokens'];
  crv3Underlying: BeanstalkSDK['tokens']['crv3Underlying'];
};

export type SDKTokens = BeanstalkSDK['tokens'];

export function useSDKTokenList(key: keyof SDKTokenList) {
  const sdk = useSdk();
  return sdk.tokens[key];
}

export function useSdkTokenListMap(tokenList: keyof SDKTokenList) {
  const sdk = useSdk();
  return useMemo(
    () =>
      [...sdk.tokens[tokenList]].reduce<AddressMap<Token>>((prev, curr) => {
        prev[curr.address] = curr;
        return prev;
      }, {}),
    [sdk.tokens, tokenList]
  );
}

export function useSdkToken(tokenList: keyof SDKTokenList, address: string) {
  const sdk = useSdk();

  return useMemo(() => {
    const tokenMap = [...sdk.tokens[tokenList]].reduce<AddressMap<Token>>(
      (prev, curr) => {
        prev[curr.address] = curr;
        return prev;
      },
      {}
    );
    return tokenMap[address] ?? undefined;
  }, [address, sdk.tokens, tokenList]);
}

export function useToTokenMap<T extends Token>(list: (T[] | Set<T>)): AddressMap<T> {
  return useMemo(() => [...list].reduce<AddressMap<T>>(
    (acc, token) => {
      acc[token.address] = token;
      return acc;
    }, {}
  ), [list]);
}

export function isSameToken(token1: Token, token2: Token) {
  return token1.address === token2.address;
}

export function useSdkMiddleware() {
  const sdk = useSdk();
  
  const getSdkToken = useCallback((_token: TokenOld) => {
    const token = sdk.tokens.findByAddress(_token.address);
    return token as ERC20Token | NativeToken;
  }, [sdk.tokens]);

  const getSdkPool = useCallback((_pool: PoolOld | null) => {
    if (!_pool) return null;
    return [...sdk.pools.pools].find((p) => p.address === _pool.address);
  }, [sdk.pools.pools]);

  return {
    getSdkPool,
    getSdkToken,
  };
}

export function useWorkflows() {
  const sdk = useSdk();
  
  const ethOrWethToBean = useCallback((eth?: boolean, from?: FarmFromMode, to?: FarmToMode) => {
    const steps = [];
    if (eth) steps.push(new sdk.farm.actions.WrapEth());
    steps.push(...[
      new sdk.farm.actions.Exchange(
        sdk.contracts.curve.pools.tricrypto2.address,
        sdk.contracts.curve.registries.cryptoFactory.address,
        sdk.tokens.WETH,
        sdk.tokens.USDT
      ),
      new sdk.farm.actions.ExchangeUnderlying(
        sdk.contracts.curve.pools.beanCrv3.address,
        sdk.tokens.USDT,
        sdk.tokens.BEAN,
        from ?? undefined, // defaults to INTERNAL_TOLERANT
        to ?? FarmToMode.EXTERNAL
      )
    ]);

    return steps;
  }, [sdk]);

  return { 
    ethOrWethToBean
  };
}
