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
        const result = await sdk.silo.getBalance(sdkLPToken!, address, { source: DataSource.LEDGER });
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

export const useSiloBalanceMany = (tokens: Token[]) => {
  const { address } = useAccount();
  const sdk = useSdk();

  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery<Record<string, TokenValue>, Error>(
    ["silo", "balance", sdk, ...tokens.map((token) => token.symbol)],
    async () => {
      const resultMap: Record<string, TokenValue> = {};
      if (!address) return resultMap;

      /**
       * For some reason the symbol sdk.tokens.findByAddress returns a
       * token with symbol of BEANETH & the token symbol stored in the well is BEANWETHCP2w
       *
       * We find the silo balance using the token with symbol BEANETH &
       * then use BEANWETHCP2w as the key in the resultMap
       */
      const _tokens = tokens
        .map((token) => {
          return {
            token,
            sdkToken: sdk.tokens.findByAddress(token.address)
          };
        })
        .filter((tk) => tk.sdkToken !== undefined);

      const result = await Promise.all(
        _tokens.map((item) =>
          sdk.silo
            .getBalance(item.sdkToken!, address, { source: DataSource.LEDGER })
            .then((result) => ({ token: item.token, amount: result.amount }))
        )
      );

      result.forEach((val) => {
        resultMap[val.token.symbol] = val.amount;
        queryClient.setQueryData(["silo", "balance", sdk, val.token.symbol], val.amount);
      });

      return resultMap;
    }
  );

  return { data, isLoading, error, refetch, isFetching };
};
