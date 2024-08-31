import { useMemo } from 'react';
import { Token, ERC20Token, BeanstalkToken, NativeToken } from '@beanstalk/sdk';
import LegacyToken, {
  ERC20Token as LegacyERC20Token,
  BeanstalkToken as LegacyBeanstalkToken,
  NativeToken as LegacyNativeToken,
} from '~/classes/Token';
import { TokenMap } from '~/constants';
import useSdk from '~/hooks/sdk';
import { useAppSelector } from '~/state';
import { BeanPools } from '~/state/bean/pools';

// -------------------------
// Token Instances
// eventually we should be able to remove the LegacyToken types
// and just use the Token types from @beanstalk/sdk
// -------------------------
/** @deprecated */
export type TokenInstance = Token | LegacyToken;
/** @deprecated */
export type ERC20TokenInstance = ERC20Token | LegacyERC20Token;
/** @deprecated */
export type BeanstalkTokenInstance = BeanstalkToken | LegacyBeanstalkToken;
/** @deprecated */
export type NativeTokenInstance = NativeToken | LegacyNativeToken;
/** @deprecated */
export type AnyToken =
  | TokenInstance
  | ERC20TokenInstance
  | BeanstalkTokenInstance
  | NativeTokenInstance;

/**
 *
 * @returns all balance tokens from the SDK all ERC20 tokens + ETH
 */
export const useTokens = (): {
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
  tokenMap: TokenMap<ERC20Token>;
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

    const tokenMap = Object.values(balanceTokens).reduce<TokenMap<ERC20Token>>(
      (acc, token) => {
        acc[token.address] = token as ERC20Token;
        return acc;
      },
      {}
    );

    return { ...balanceTokens, tokenMap };
  }, [sdk]);
};

/**
 * @returns all beanstalk tokens from the SDK STALK, SEEDS, SPROUTS, rSPROUTS, PODS
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

export const useUnripeTokens = () => {
  const sdk = useSdk();

  return useMemo(() => {
    const arr = Array.from(sdk.tokens.unripeTokens as Set<ERC20Token>);
    const tokenMap = arr.reduce<TokenMap<ERC20Token>>((acc, token) => {
      acc[token.address] = token;
      return acc;
    }, {});
    return {
      UNRIPE_BEAN: sdk.tokens.UNRIPE_BEAN,
      UNRIPE_BEAN_WSTETH: sdk.tokens.UNRIPE_BEAN_WSTETH,
      tokenMap,
    };
  }, [sdk]);
};

/**
 * @param sortByLiquidity - If true, sort Well LP tokens by liquidity (highest to lowest)
 */
export const useWhitelistedTokens = (sortByLiquidity?: boolean) => {
  const sdk = useSdk();
  const pools = useAppSelector((s) => s._bean.pools);

  return useMemo(() => {
    const whitelist = getWhitelistSorted(
      sdk.tokens,
      sortByLiquidity ? pools : undefined
    );
    const tokenMap = whitelist.reduce<TokenMap<ERC20Token>>((acc, token) => {
      acc[token.address] = token;
      return acc;
    }, {});

    return { whitelist, tokenMap };
  }, [sdk, pools, sortByLiquidity]);
};

/**
 * Sort the whitelist by
 * [
 *  0: BEAN,
 *  1...n - 2: LP (sorted by liquidity use default sort order)
 *  n - 1: urBEAN,
 *  n: urBEANwstETH
 * ]
 */
/**
 * Sorts the whitelist of tokens based on specific criteria:
 * 1. BEAN token is always first
 * 2. Unripe tokens are pushed towards the end [...restTokens, urBEAN, urBEANwstETH]
 * 3. Well LP tokens
 *   - If pools data is provided, tokens are sorted by liquidity (highest to lowest)
 *   - otherwise, retain original insertion order
 *
 * @param tokens - The tokens object from the SDK
 * @param pools - Optional BeanPools object containing liquidity information
 * @returns A sorted array of ERC20Token objects
 */
function getWhitelistSorted(
  tokens: ReturnType<typeof useSdk>['tokens'],
  pools?: BeanPools
) {
  const whitelist = Array.from(tokens.siloWhitelist as Set<ERC20Token>);
  return whitelist.sort((a, b) => {
    // When either token is BEAN
    if (a.equals(tokens.BEAN) || b.equals(tokens.BEAN)) {
      // BEAN should always be first
      return a.equals(tokens.BEAN) ? -1 : 1;
    }
    // When either token is unripe
    if (a.isUnripe || b.isUnripe) {
      if (a.isUnripe && b.isUnripe) {
        return a.equals(tokens.UNRIPE_BEAN) ? -1 : 1;
      }
      // push unripe towards the end
      return a.isUnripe ? 1 : -1;
    }

    if (pools) {
      const poolA = pools[a.address];
      const poolB = pools[b.address];

      if (poolA && poolB) {
        return poolB.liquidity.minus(poolA.liquidity).toNumber();
      }
    }

    // If we can't sort by liquidity, retain insertion order
    return 0;
  });
}
