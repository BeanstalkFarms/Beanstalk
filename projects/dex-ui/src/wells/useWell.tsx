import { Well } from "@beanstalk/sdk/Wells";

import {
  useChainScopedQuery,
  useGetChainScopedQueryData
} from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

export const useWell = (address: string) => {
  const sdk = useSdk();
  const getQueryData = useGetChainScopedQueryData();

  const { data, isLoading, error } = useChainScopedQuery({
    queryKey: ["well", sdk, address],

    queryFn: async () => {
      return sdk.wells.getWell(address);
    },

    placeholderData: () => {
      const cachedWell = getQueryData<Well[]>(["wells", !!sdk.signer])?.find(
        (well) => well.address === address
      );
      return cachedWell;
    },

    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return { well: data, loading: isLoading, error };
};
