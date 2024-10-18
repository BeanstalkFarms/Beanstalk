import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk-wells";

import { AddressMap } from "src/types";
import { Log } from "src/utils/logger";
import { queryKeys } from "src/utils/query/queryKeys";
import { UseReactQueryOptions } from "src/utils/query/types";
import useSdk from "src/utils/sdk/useSdk";

import { PriceLookups } from "./priceLookups";
import { getPrice } from "./usePrice";
import { useChainScopedQuery, useSetChainScopedQueryData } from "../query/useChainScopedQuery";

type WellOrToken = Well | ERC20Token;

type TokenPricesAllCache = undefined | void | Record<string, TokenValue>;

const getTokens = (wellOrToken: WellOrToken | WellOrToken[] | undefined) => {
  let tokens: ERC20Token[] = [];

  if (Array.isArray(wellOrToken)) {
    tokens = wellOrToken.flatMap((w) => (w instanceof Well ? w.tokens || [] : w));
  } else if (wellOrToken instanceof Well) {
    tokens = wellOrToken.tokens || [];
  } else if (wellOrToken instanceof ERC20Token) {
    tokens = [wellOrToken];
  }

  return tokens;
};

/**
 * returns
 */
export const useTokenPrices = <K = AddressMap<TokenValue>>(
  params: WellOrToken | WellOrToken[] | undefined,
  options?: UseReactQueryOptions<AddressMap<TokenValue>, K>
) => {
  const setQueryData = useSetChainScopedQueryData();
  const sdk = useSdk();

  const tokens = getTokens(params);

  const tokenSymbol = tokens.map((token) => token.symbol);

  const query = useChainScopedQuery({
    queryKey: queryKeys.tokenPrices(tokenSymbol),
    queryFn: async () => {
      const pricesResult = await Promise.all(
        tokens.map((token) => {
          if (PriceLookups[token.symbol]) return getPrice(token, sdk);

          Log.module("useTokenPrices").debug(
            "No price lookup function for ",
            token.symbol,
            "... resolving with 0"
          );
          return Promise.resolve(token.fromHuman("0"));
        })
      );

      const addressToPriceMap = tokens.reduce<AddressMap<TokenValue>>((prev, curr, i) => {
        const result = pricesResult[i];
        if (result && result.gt(0)) {
          prev[curr.symbol] = result;
        }
        return prev;
      }, {});

      /// set the cache for all token prices
      setQueryData(queryKeys.tokenPricesAll, (oldData: TokenPricesAllCache) => {
        if (!oldData) return { ...addressToPriceMap };
        return { ...oldData, ...addressToPriceMap };
      });

      return addressToPriceMap;
    },
    enabled: !!params && !!tokenSymbol.length,
    refetchInterval: 60 * 1000,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    ...options
  });

  return query;
};
