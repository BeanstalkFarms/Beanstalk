import { DataSource, Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSdk from "src/utils/sdk/useSdk";
import { useAccount } from "wagmi";

export const useSiloBalance = (token: Token) => {
  const { address } = useAccount();
  const sdk = useSdk();
  const queryClient = useQueryClient();

  const key = ["silo", "balance", sdk, token.symbol];

  const { data, isLoading, error, refetch, isFetching } = useQuery<TokenValue, Error>(
    key,
    async () => {
      let balance: TokenValue;
      if (!address) {
        balance = TokenValue.ZERO;
      } else {
        const sdkLPToken = sdk.tokens.findByAddress(token.address);
        const result = await sdk.silo.getBalance(sdkLPToken!, address, {source: DataSource.LEDGER});
        balance = result.amount;
      }
      return balance;
    },
    /**
     * Token balances are cached for 30 seconds, refetch value every 30 seconds,
     * when the window is hidden/not visible, stop background refresh,
     * when the window gains focus, force a refresh even if cache is not stale     *
     */
    {
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 30,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always"
    }
  );

  return { data, isLoading, error, refetch, isFetching };
};
