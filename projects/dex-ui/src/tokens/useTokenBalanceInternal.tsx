import { useAccount } from "wagmi";

import { Token, TokenValue } from "@beanstalk/sdk";

import { useScopedQuery } from "src/utils/query/useScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

const emptyAddress = "0x0";

/**
 * tokenBalanceInternal refers to farm balance
 */
export default function useTokenBalanceInternal(token: Token | undefined) {
  const { address } = useAccount();
  const sdk = useSdk();

  const beanstalk = sdk.contracts.beanstalk;

  const { data, isLoading, error, refetch, isFetching } = useScopedQuery({
    queryKey: ["token", "internalBalance", sdk, token?.address || emptyAddress],

    queryFn: async () => {
      const resultMap: Record<string, TokenValue> = {};

      if (address && token) {
        const result = await beanstalk.getInternalBalance(address, token.address);
        resultMap[token.symbol] = token.fromBlockchain(result);
      }

      return resultMap;
    },

    /**
     * Token balances are cached for 30 seconds, refetch value every 30 seconds,
     * when the window is hidden/not visible, stop background refresh,
     * when the window gains focus, force a refresh even if cache is not stale     *
     */
    staleTime: 1000 * 30,

    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  return { data, isLoading, error, refetch, isFetching };
}
