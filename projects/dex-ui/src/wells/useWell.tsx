import useSdk from "src/utils/sdk/useSdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";

export const useWell = (address: string) => {
  const sdk = useSdk();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["well", sdk, address],

    queryFn: async () => {
      return sdk.wells.getWell(address);
    },

    placeholderData: () => {
      const cachedWell = queryClient.getQueryData<Well[]>(["wells", !!sdk.signer])?.find((well) => well.address === address);
      return cachedWell;
    },

    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return { well: data, loading: isLoading, error };
};
