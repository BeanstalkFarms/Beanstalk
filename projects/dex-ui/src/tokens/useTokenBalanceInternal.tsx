import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
import useSdk from "src/utils/sdk/useSdk";
import { useAccount } from "wagmi";

const emptyAddress = "0x0";

/**
 * tokenBalanceInternal refers to farm balance
 */
export default function useTokenBalanceInternal(_token: Token | undefined) {
  const { address } = useAccount();
  const sdk = useSdk();

  const beanstalk = sdk.contracts.beanstalk;

  const { data, isLoading, error, refetch, isFetching } = useQuery<TokenValue, Error>(
    ["farmer", "internalBalance", sdk, _token?.address || emptyAddress],
    async () => {
      if (!address || !_token) return TokenValue.ZERO;
      const token = sdk.tokens.findByAddress(_token.address);

      if (!token) return TokenValue.ZERO;

      const result = await beanstalk.getInternalBalance(address, token.address);
      return token.fromBlockchain(result);
    },
    {
      /**
       * Token balances are cached for 30 seconds, refetch value every 30 seconds,
       * when the window is hidden/not visible, stop background refresh,
       * when the window gains focus, force a refresh even if cache is not stale     *
       */
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 30,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always"
    }
  );

  return { data, isLoading, error, refetch, isFetching };
}
