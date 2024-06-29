import { ERC20Token } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "src/utils/query/queryKeys";
import { useAccount } from "wagmi";

export const useTokenAllowance = (token: ERC20Token | undefined, spender: string) => {
  const { address: walletAddress } = useAccount();

  return useQuery({
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
