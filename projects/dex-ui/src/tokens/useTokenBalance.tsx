import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export const useTokenBalance = (token: Token) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const key = ["token", "balance", token.symbol];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: key,

    queryFn: async () => {
      let balance: TokenValue;
      if (!address) {
        balance = TokenValue.ZERO;
      } else {
        balance = await token.getBalance(address);
      }

      const result = {
        [token.symbol]: balance
      };

      // Also update the cache of "ALL" token query
      queryClient.setQueryData(["token", "balance"], (oldData: undefined | void | Record<string, TokenValue>) => {
        if (!oldData) return result;

        return { ...oldData, ...result };
      });

      return result;
    },

    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  return { data, isLoading, error, refetch, isFetching };
};
