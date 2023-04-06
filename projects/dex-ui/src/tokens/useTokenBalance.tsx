import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export const useTokenBalance = (token: Token) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const key = ["token", "balance", token.symbol];

  const { data, isLoading, error, refetch, isFetching } = useQuery<Record<string, TokenValue>, Error>(
    key,
    async () => {
      console.log(`Query: Get ${token.symbol} balance`);

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
    /**
     * Token balances are cached for 15 seconds, refetch value every 15 seconds,
     * when the window is hidden/not visible, stop background refresh,
     * when the window gains focus, force a refresh even if cache is not stale     *
     */
    {
      staleTime: 1000 * 15,
      refetchInterval: 1000 * 15,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always"
    }
  );

  return { data, isLoading, error, refetch, isFetching };
};
