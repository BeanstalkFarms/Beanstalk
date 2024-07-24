import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "src/utils/query/queryKeys";
import { useAccount } from "wagmi";

type TokenBalanceCache = undefined | void | Record<string, TokenValue>;

export const useTokenBalance = (token: Token | undefined) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.tokenBalance(token?.symbol),

    queryFn: async () => {
      if (!token) return;

<<<<<<< HEAD
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: key,

    queryFn: async () => {
=======
>>>>>>> master
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
      queryClient.setQueryData(queryKeys.tokenBalancesAll, (oldData: TokenBalanceCache) => {
        if (!oldData) return result;

        return { ...oldData, ...result };
      });

      return result;
    },
<<<<<<< HEAD

=======
    enabled: !!token,
>>>>>>> master
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  return { data, isLoading, error, refetch, isFetching };
};
