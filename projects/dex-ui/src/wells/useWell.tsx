import { Well } from "@beanstalk/sdk/Wells";
import { useQueryClient } from "@tanstack/react-query";

import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

export const useWell = (address: string) => {
  const sdk = useSdk();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useChainScopedQuery({
    queryKey: ["well", sdk, address],

    queryFn: async () => {
      return sdk.wells.getWell(address);
    },

    placeholderData: () => {
      const cachedWell = queryClient
        .getQueryData<Well[]>([[sdk.chainId], "wells", !!sdk.signer])
        ?.find((well) => well.address === address);
      return cachedWell;
    },

    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return { well: data, loading: isLoading, error };
};
