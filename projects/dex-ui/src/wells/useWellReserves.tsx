import useSdk from "src/utils/sdk/useSdk";
import { useQuery } from "@tanstack/react-query";
import { Well } from "@beanstalk/sdk/Wells";
import { TokenValue } from "@beanstalk/sdk";

export const useWellReserves = (well: Well) => {
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useQuery<TokenValue[], Error>(
    ["well", sdk, well.address, "reserves"],
    async () => {
      let reserves: TokenValue[];
      reserves = await well.getReserves();
      return reserves;
    },
    {
      staleTime: 1000 * 60,
      refetchInterval: 1000 * 60,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always"
    }
  );

  return { reserves: data, loading: isLoading, error, refetch, isFetching };
};
