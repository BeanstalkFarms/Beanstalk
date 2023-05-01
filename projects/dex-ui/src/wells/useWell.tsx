import useSdk from "src/utils/sdk/useSdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";

export const useWell = (address: string) => {
  const sdk = useSdk();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Well, Error>(
    ["well", address],
    async () => {
      console.log("Fetching Well", address);
      return sdk.wells.getWell(address);
    },
    {
      placeholderData: () => {
        const cachedWell = queryClient.getQueryData<Well[]>(["wells", !!sdk.signer])?.find((well) => well.address === address);
        if (cachedWell) {
          console.log("Got well from cache", address);
        }
        return cachedWell;
      },
      staleTime: Infinity,
      refetchOnWindowFocus: false
    }
  );

  return { well: data, loading: isLoading, error };
};
