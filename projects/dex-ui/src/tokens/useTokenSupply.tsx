import { ERC20Token } from "@beanstalk/sdk-core";

import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

export const useTokenSupply = (address: ERC20Token) => {
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useChainScopedQuery({
    queryKey: ["well", sdk, address, "totalSupply"],

    queryFn: async () => {
      let totalSupply = await address.getTotalSupply();
      return totalSupply;
    },

    staleTime: 1000 * 60,
    refetchOnWindowFocus: false
  });

  return { totalSupply: data, loading: isLoading, error, refetch, isFetching };
};

/// useTokenSupply but for multiple tokens
export const useTokenSupplyMany = (tokens: ERC20Token[]) => {
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useChainScopedQuery({
    queryKey: ["well", sdk, tokens, "totalSupply"],

    queryFn: async () => {
      let tokenTotalSupplies = await Promise.all(tokens.map((token) => token.getTotalSupply()));
      return tokenTotalSupplies;
    },

    staleTime: 1000 * 60,
    refetchOnWindowFocus: false
  });

  return { totalSupply: data, loading: isLoading, error, refetch, isFetching };
};
