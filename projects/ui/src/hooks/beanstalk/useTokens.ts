import { useMemo } from 'react';
import { BeanstalkToken, ERC20Token, NativeToken } from '@beanstalk/sdk';
import useSdk from '../sdk';

/**
 *
 * @returns all balance tokens from the SDK (includes Well LP tokens)
 */
export const useBalanceTokens = (): {
  ETH: NativeToken;
  WETH: ERC20Token;
  WSTETH: ERC20Token;
  WEETH: ERC20Token;
  WBTC: ERC20Token;
  BEAN: ERC20Token;
  USDC: ERC20Token;
  USDT: ERC20Token;
  DAI: ERC20Token;
  ARB: ERC20Token;
  UNRIPE_BEAN: ERC20Token;
  UNRIPE_BEAN_WSTETH: ERC20Token;
  BEAN_ETH_WELL_LP: ERC20Token;
  BEAN_WSTETH_WELL_LP: ERC20Token;
  BEAN_WEETH_WELL_LP: ERC20Token;
  BEAN_WBTC_WELL_LP: ERC20Token;
  BEAN_USDC_WELL_LP: ERC20Token;
  BEAN_USDT_WELL_LP: ERC20Token;
} => {
  const sdk = useSdk();

  return useMemo(() => {
    const tokens = sdk.tokens;

    const balanceTokens = {
      ETH: tokens.ETH,
      WETH: tokens.WETH,
      WSTETH: tokens.WSTETH,
      WEETH: tokens.WEETH,
      WBTC: tokens.WBTC,
      BEAN: tokens.BEAN,
      USDC: tokens.USDC,
      USDT: tokens.USDT,
      DAI: tokens.DAI,
      ARB: tokens.ARB,
      UNRIPE_BEAN: tokens.UNRIPE_BEAN,
      UNRIPE_BEAN_WSTETH: tokens.UNRIPE_BEAN_WSTETH,
      BEAN_ETH_WELL_LP: tokens.BEAN_ETH_WELL_LP,
      BEAN_WSTETH_WELL_LP: tokens.BEAN_WSTETH_WELL_LP,
      BEAN_WEETH_WELL_LP: tokens.BEAN_WEETH_WELL_LP,
      BEAN_WBTC_WELL_LP: tokens.BEAN_WBTC_WELL_LP,
      BEAN_USDC_WELL_LP: tokens.BEAN_USDC_WELL_LP,
      BEAN_USDT_WELL_LP: tokens.BEAN_USDT_WELL_LP,
    };
    return balanceTokens;
  }, [sdk]);
};

/**
 * @returns all beanstalk tokens from the SDK
 * STALK, SEEDS, SPROUTS, RSPROUTS, PODS
 */
export const useBeanstalkTokens = (): {
  STALK: BeanstalkToken;
  SEEDS: BeanstalkToken;
  SPROUTS: BeanstalkToken;
  rSPROUTS: BeanstalkToken;
  PODS: BeanstalkToken;
} => {
  const sdk = useSdk();

  return useMemo(() => {
    const tokens = sdk.tokens;
    const beanstalkTokens = {
      STALK: tokens.STALK,
      SEEDS: tokens.SEEDS,
      SPROUTS: tokens.SPROUTS,
      rSPROUTS: tokens.RINSABLE_SPROUTS,
      PODS: tokens.PODS,
    };
    return beanstalkTokens;
  }, [sdk]);
};
