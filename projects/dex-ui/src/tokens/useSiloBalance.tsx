import { DataSource, Token, TokenValue } from "@beanstalk/sdk";
import { queryKeys } from "src/utils/query/queryKeys";
import { useScopedQuery, useSetScopedQueryData } from "src/utils/query/useScopedQuery";
import useSdk from "src/utils/sdk/useSdk";
import { useAccount } from "wagmi";

export const useSiloBalance = (token: Token) => {
  const { address } = useAccount();
  const sdk = useSdk();

  const { data, isLoading, error, refetch, isFetching } = useScopedQuery({
    queryKey: queryKeys.siloBalance(token.symbol),

    queryFn: async (): Promise<TokenValue> => {
      let balance: TokenValue;
      if (!address) {
        balance = TokenValue.ZERO;
      } else {
        const sdkLPToken = sdk.tokens.findByAddress(token.address);
        const result = await sdk.silo.getBalance(sdkLPToken!, address, {
          source: DataSource.LEDGER
        });
        balance = result.amount;
      }
      return balance;
    },

    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  return { data, isLoading, error, refetch, isFetching };
};

export const useSiloBalanceMany = (tokens: Token[]) => {
  const { address } = useAccount();
  const sdk = useSdk();
  const setQueryData = useSetScopedQueryData();

  const { data, isLoading, error, refetch, isFetching } = useScopedQuery({
    queryKey: queryKeys.siloBalanceMany(tokens.map((t) => t.symbol)),
    queryFn: async () => {
      const resultMap: Record<string, TokenValue> = {};
      if (!address) return resultMap;

      /**
       * For some reason the symbol sdk.tokens.findByAddress returns a
       * token with symbol of BEANETH & the token symbol stored in the well is BEANWETHCP2w
       *
       * We find the silo balance using the token with symbol BEANETH &
       * then use BEANWETHCP2w as the key in the resultMap
       */
      const filteredTokens = tokens
        .filter((t) => {
          const sdkToken = sdk.tokens.findByAddress(t.address);
          return !!(sdkToken && sdk.tokens.isWhitelisted(sdkToken));
        })
        .map((tk) => ({
          token: tk,
          sdkToken: sdk.tokens.findByAddress(tk.address)!
        }));

      const results = await Promise.all(
        filteredTokens.map(async (item) =>
          await sdk.silo
            .getBalance(item.sdkToken, address, { source: DataSource.LEDGER })
            .then((result) => ({ token: item.token, amount: result.amount }))
        )
      );

      console.log("resulst: ", results);

      results.forEach((val) => {
        resultMap[val.token.symbol] = val.amount;

        // merge data into [scope, 'silo', token.symbol]
        setQueryData(queryKeys.siloBalancesAll, (oldData) => {
          if (!oldData) return { [val.token.symbol]: val.amount };
          return { ...oldData, [val.token.symbol]: val.amount };
        });
        setQueryData(queryKeys.siloBalance(val.token.symbol), () => {
          return val.amount;
        });
      });
      return resultMap;
    },
    enabled: !!address && !!tokens.length && !!sdk
  });

  return { data, isLoading, error, refetch, isFetching };
};
