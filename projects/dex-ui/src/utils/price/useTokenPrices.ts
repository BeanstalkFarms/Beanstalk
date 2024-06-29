import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk-wells";
import { queryKeys } from "../query/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSdk from "../sdk/useSdk";
import { getPrice } from "./usePrice";
import { PriceLookups } from "./priceLookups";
import { Log } from "../../utils/logger";
import { AddressMap } from "src/types";
import { UseReactQueryOptions } from "../query/types";

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
  const queryClient = useQueryClient();
  const sdk = useSdk();

  const tokens = getTokens(params);

  const tokenSymbol = tokens.map((token) => token.symbol);

  const query = useQuery({
    queryKey: queryKeys.tokenPrices(tokenSymbol),
    queryFn: async () => {
      const pricesResult = await Promise.all(
        tokens.map((token) => {
          if (PriceLookups[token.symbol]) return getPrice(token, sdk);

          Log.module("useTokenPrices").debug("No price lookup function for ", token.symbol, "... resolving with 0");
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
      queryClient.setQueryData(queryKeys.tokenPricesAll, (oldData: TokenPricesAllCache) => {
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
