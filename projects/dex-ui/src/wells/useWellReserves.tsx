import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { TokenValue } from "@beanstalk/sdk";

export const useWellReserves = (well: Well) => {
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["well", sdk, well.address, "reserves"],

    queryFn: async () => {
      let reserves: TokenValue[];
      reserves = await well.getReserves();
      return reserves;
    },

    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return { reserves: data, loading: isLoading, error, refetch, isFetching };
};
