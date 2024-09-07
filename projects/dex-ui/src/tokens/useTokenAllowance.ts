import { useAccount } from "wagmi";

import { ERC20Token } from "@beanstalk/sdk";

import { queryKeys } from "src/utils/query/queryKeys";
import { useScopedQuery } from "src/utils/query/useScopedQuery";

export const useTokenAllowance = (token: ERC20Token | undefined, spender: string) => {
  const { address: walletAddress } = useAccount();

  return useScopedQuery({
    queryKey: queryKeys.tokenAllowance(token?.address, spender),
    queryFn: async () => {
      if (!token) return;
      return token.getAllowance(walletAddress as string, spender);
    },
    enabled: !!token,
    refetchOnWindowFocus: "always",
    staleTime: 1000 * 30 // 30 seconds,
  });
};
