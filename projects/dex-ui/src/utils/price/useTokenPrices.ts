import { ERC20Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk-wells";
import { queryKeys } from "../query/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSdk from "../sdk/useSdk";
import { getPrice } from "./usePrice";

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

export const useTokenPrices = (params: WellOrToken | WellOrToken[] | undefined) => {
  const queryClient = useQueryClient();
  const sdk = useSdk();

  const tokens = getTokens(params);

  const tokenAddresses = tokens.map((token) => token.address);

  const query = useQuery({
    queryKey: queryKeys.tokenPrices(tokenAddresses),
    queryFn: async () => {
      const pricesResult = await Promise.all(tokens.map((token) => getPrice(token, sdk)));

      const addressToPriceMap = tokens.reduce<Record<string, TokenValue>>((prev, curr, i) => {
        const result = pricesResult[i];
        if (result) {
          prev[curr.address] = result;
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
    enabled: !!params && !!tokenAddresses.length
  });

  return query;
};
