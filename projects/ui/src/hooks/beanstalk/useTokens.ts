import { useCallback, useMemo } from 'react';
import { Token, ERC20Token, BeanstalkToken, NativeToken } from '@beanstalk/sdk';
import LegacyToken, {
  ERC20Token as LegacyERC20Token,
  BeanstalkToken as LegacyBeanstalkToken,
  NativeToken as LegacyNativeToken,
} from '~/classes/Token';
import { ChainConstant, SupportedChainId, TokenMap } from '~/constants';
import * as ADDRESSES from '~/constants/addresses';
import useSdk from '~/hooks/sdk';
import { useAppSelector } from '~/state';
import { BeanPools } from '~/state/bean/pools';
import * as LegacyTokens from '~/constants/tokens';
import { getTokenIndex, isSdkToken } from '~/util';
import useChainState from '~/hooks/chain/useChainState';
import { useResolvedChainId } from '../chain/useChainId';

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
  erc20TokenMap: TokenMap<ERC20Token>;
  erc20Tokens: ERC20Token[];
  addresses: string[];
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

    const erc20TokenMap = Object.values(balanceTokens).reduce<
      TokenMap<ERC20Token>
    >((acc, token) => {
      const tokenIndex = getTokenIndex(token);
      if (tokenIndex === 'eth') return acc;
      acc[getTokenIndex(token)] = token as ERC20Token;
      return acc;
    }, {});

    const erc20Tokens = Object.values(erc20TokenMap);
    const addresses = Object.values(balanceTokens).map((t) => t.address);

    return { ...balanceTokens, erc20TokenMap, erc20Tokens, addresses };
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
      unripeTokens: arr,
      tokenMap,
    };
  }, [sdk]);
};

export const useGetUnripeTokenWithAddress = () => {
  const urTokens = useUnripeTokens();

  const getUnripeSdkToken = useCallback(
    (_address: string) => {
      const address = _address.toLowerCase();

      if (Object.values(ADDRESSES.UNRIPE_BEAN_ADDRESSES).includes(address)) {
        return urTokens.UNRIPE_BEAN;
      }

      if (
        Object.values(ADDRESSES.UNRIPE_BEAN_WSTETH_ADDRESSES).includes(address)
      ) {
        return urTokens.UNRIPE_BEAN_WSTETH;
      }
    },
    [urTokens]
  );

  return {
    getUnripeSdkToken,
  };
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
    const addresses = whitelist.map((t) => t.address);

    return { whitelist, tokenMap, addresses };
  }, [sdk, pools, sortByLiquidity]);
};

export const useSupportedBalanceTokens = () => {
  const sdk = useSdk();

  return useMemo(() => {
    const tokens = [...sdk.tokens.erc20Tokens, sdk.tokens.ETH] as (
      | ERC20Token
      | NativeToken
    )[];

    const tokenMap = tokens.reduce<TokenMap<ERC20Token | NativeToken>>(
      (acc, token) => {
        acc[token.address] = token as ERC20Token;
        return acc;
      },
      { [getTokenIndex(sdk.tokens.ETH)]: sdk.tokens.ETH }
    );

    return {
      tokenMap,
      tokens,
    };
  }, [sdk]);
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

const cARB = SupportedChainId.ARBITRUM_MAINNET;
const cETH = SupportedChainId.ETH_MAINNET;

const oldTokenMap: Record<string, ChainConstant<LegacyToken> | LegacyToken> = {
  [LegacyTokens.ETH[cARB].symbol]: LegacyTokens.ETH,
  [LegacyTokens.BEAN[cARB].symbol]: LegacyTokens.BEAN,
  [LegacyTokens.UNRIPE_BEAN[cARB].symbol]: LegacyTokens.UNRIPE_BEAN,
  [LegacyTokens.UNRIPE_BEAN_WSTETH[cARB].symbol]:
    LegacyTokens.UNRIPE_BEAN_WSTETH,
  [LegacyTokens.WETH[cARB].symbol]: LegacyTokens.WETH,
  [LegacyTokens.DAI[cARB].symbol]: LegacyTokens.DAI,
  [LegacyTokens.USDC[cARB].symbol]: LegacyTokens.USDC,
  [LegacyTokens.USDT[cARB].symbol]: LegacyTokens.USDT,
  [LegacyTokens.WSTETH[cARB].symbol]: LegacyTokens.WSTETH,
  [LegacyTokens.WEETH[cARB].symbol]: LegacyTokens.WEETH,
  [LegacyTokens.WBTC[cARB].symbol]: LegacyTokens.WBTC,
  [LegacyTokens.BEAN_ETH_WELL_LP[cARB].symbol]: LegacyTokens.BEAN_ETH_WELL_LP,
  [LegacyTokens.BEAN_WSTETH_WELL_LP[cARB].symbol]:
    LegacyTokens.BEAN_WSTETH_WELL_LP,
  [LegacyTokens.BEAN_WEETH_WELL_LP[cARB].symbol]:
    LegacyTokens.BEAN_WEETH_WELL_LP,
  [LegacyTokens.BEAN_WBTC_WELL_LP[cARB].symbol]: LegacyTokens.BEAN_WBTC_WELL_LP,
  [LegacyTokens.BEAN_USDC_WELL_LP[cARB].symbol]: LegacyTokens.BEAN_USDC_WELL_LP,
  [LegacyTokens.BEAN_USDT_WELL_LP[cARB].symbol]: LegacyTokens.BEAN_USDT_WELL_LP,
  [LegacyTokens.STALK.symbol]: LegacyTokens.STALK,
  [LegacyTokens.SEEDS.symbol]: LegacyTokens.SEEDS,
  [LegacyTokens.PODS.symbol]: LegacyTokens.PODS,
  [LegacyTokens.SPROUTS.symbol]: LegacyTokens.SPROUTS,
  [LegacyTokens.RINSABLE_SPROUTS.symbol]: LegacyTokens.RINSABLE_SPROUTS,
  [LegacyTokens.BEAN_CRV3_LP[cETH].symbol]: LegacyTokens.BEAN_CRV3_LP,
  [LegacyTokens.CRV3[cETH].symbol]: LegacyTokens.CRV3,
  [LegacyTokens.BEAN_ETH_UNIV2_LP[cETH].symbol]: LegacyTokens.BEAN_ETH_UNIV2_LP,
  [LegacyTokens.BEAN_LUSD_LP[cETH].symbol]: LegacyTokens.BEAN_LUSD_LP,
  [LegacyTokens.LUSD[cETH].symbol]: LegacyTokens.LUSD,
} as const;

export const useGetLegacyToken = () => {
  const { chainId, fallbackChainId } = useChainState();

  const getLegacyToken = useCallback(
    (token: TokenInstance): LegacyToken => {
      if (!isSdkToken(token)) return token;
      const oldToken = oldTokenMap[token.symbol];

      if (oldToken instanceof LegacyToken) return oldToken;
      return oldToken[chainId] || oldToken[fallbackChainId];
    },
    [chainId, fallbackChainId]
  );

  return getLegacyToken;
};

const makeEntry = (
  a: ChainConstant<string>,
  t: ChainConstant<LegacyToken>
) => ({
  ...(a[cARB] && t[cARB] ? { [a[cARB]]: t } : {}),
  ...(a[cETH] && t[cETH] ? { [a[cETH]]: t } : {}),
});

const A = ADDRESSES;
const L = LegacyTokens;

const ADDRESS_TO_CHAIN_CONSTANT: Record<string, ChainConstant<LegacyToken>> = {
  // BEAN
  ...makeEntry(A.BEAN_ADDRESSES, L.BEAN),

  // UNRIPE

  ...makeEntry(A.UNRIPE_BEAN_ADDRESSES, L.UNRIPE_BEAN),
  ...makeEntry(A.UNRIPE_BEAN_WSTETH_ADDRESSES, L.UNRIPE_BEAN_WSTETH),

  // ERC20
  ...makeEntry(A.WETH_ADDRESSES, L.WETH),
  ...makeEntry(A.WSTETH_ADDRESSES, L.WSTETH),
  ...makeEntry(A.WEETH_ADDRESSES, L.WEETH),
  ...makeEntry(A.WBTC_ADDRESSES, L.WBTC),
  ...makeEntry(A.DAI_ADDRESSES, L.DAI),
  ...makeEntry(A.USDC_ADDRESSES, L.USDC),
  ...makeEntry(A.USDT_ADDRESSES, L.USDT),
  ...makeEntry(A.ARB_ADDRESSES, L.ARB),

  // LP
  ...makeEntry(A.BEAN_ETH_WELL_ADDRESSES, L.BEAN_ETH_WELL_LP),
  ...makeEntry(A.BEAN_WSTETH_ADDRESSS, L.BEAN_WSTETH_WELL_LP),
  ...makeEntry(A.BEANWEETH_WELL_ADDRESSES, L.BEAN_WEETH_WELL_LP),
  ...makeEntry(A.BEANWBTC_WELL_ADDRESSES, L.BEAN_WBTC_WELL_LP),
  ...makeEntry(A.BEANUSDC_WELL_ADDRESSES, L.BEAN_USDC_WELL_LP),
  ...makeEntry(A.BEANUSDT_WELL_ADDRESSES, L.BEAN_USDT_WELL_LP),

  // Deprecated
  // ...makeEntry(A.CRV3_ADDRESSES, L.CRV3),
  // ...makeEntry(A.BEAN_CRV3_ADDRESSES, L.BEAN_CRV3_LP),
  // ...makeEntry(A.BEAN_LUSD_ADDRESSES, L.BEAN_LUSD_LP),
  // ...makeEntry(A.LUSD_ADDRESSES, L.LUSD),
  // ...makeEntry(A.BEAN_ETH_UNIV2_LP_ADDRESSES, L.BEAN_ETH_UNIV2_LP),
} as const;

/**
 *
 * @returns a function that takes an address (chain agnostic) and returns the sdk token instance
 * for the chain the user is currently on
 *
 */
export const useGetNormaliseChainToken = () => {
  const { erc20TokenMap } = useTokens();
  const chainId = useResolvedChainId();

  /**
   * returns the sdk token instance for the chain the user is currently on if available
   */
  const getToken = useCallback(
    (_address: string) => {
      const token = ADDRESS_TO_CHAIN_CONSTANT[_address.toLowerCase()];

      return token?.[chainId]
        ? erc20TokenMap[getTokenIndex(token[chainId])]
        : undefined;
    },
    [erc20TokenMap, chainId]
  );

  return getToken;
};