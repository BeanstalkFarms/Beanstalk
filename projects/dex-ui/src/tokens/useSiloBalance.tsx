import { useAccount } from "wagmi";

import { Token, TokenValue } from "@beanstalk/sdk";
import { ChainResolver } from "@beanstalk/sdk-core";

import { getIsValidEthereumAddress } from "src/utils/addresses";
import { queryKeys } from "src/utils/query/queryKeys";
import { useScopedQuery, useSetScopedQueryData } from "src/utils/query/useScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

export const useSiloBalance = (token: Token) => {
  const { address } = useAccount();
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useScopedQuery({
    queryKey: queryKeys.siloBalance(token.address),

    queryFn: async (): Promise<TokenValue> => {
      let balance: TokenValue;
      if (!address) {
        balance = TokenValue.ZERO;
      } else {
        const sdkLPToken = sdk.tokens.findByAddress(token.address);
        const result = await sdk.silo.getBalance(sdkLPToken!, address);
        balance = result.amount;
      }
      return balance;
    },

    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  return { data, isLoading, error, refetch, isFetching };
};

export const useFarmerWellsSiloBalances = () => {
  const { address } = useAccount();
  const sdk = useSdk();
  const setQueryData = useSetScopedQueryData();
  const wellTokens = Array.from(sdk.tokens.wellLP).map((t) => t.address);

  const { data, isLoading, error, refetch, isFetching } = useScopedQuery({
    queryKey: queryKeys.siloBalancesAll(wellTokens),
    queryFn: async () => {
      // Silo balances are not available on L1
      if (ChainResolver.isL1Chain(sdk.chainId)) {
        return {};
      }
      try {
        const resultMap: Record<string, TokenValue> = {};
        if (!address) return resultMap;

        const results = await sdk.silo.getBalances(address);

        results.forEach((val, token) => {
          resultMap[token.address] = val.amount;
          setQueryData(queryKeys.siloBalance(token.address), () => val.amount);
        });

        return resultMap;
      } catch (e) {
        console.error("Error fetching silo balances: ", e);
        return {};
      }
    },
    enabled: getIsValidEthereumAddress(address) && !!wellTokens.length,
    retry: false
  });

  return { data, isLoading, error, refetch, isFetching };
};
