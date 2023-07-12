import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useTokens } from "./TokenProvider";
import { Log } from "src/utils/logger";

const TokenBalanceABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function"
  }
] as const;

export const useAllTokensBalance = () => {
  const tokens = useTokens();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // Remove ETH from this list, manually get the balance below
  const tokensToLoad = Object.values(tokens).filter((t) => t.symbol !== "ETH");
  if (tokensToLoad.length > 20) throw new Error("Too many tokens to load balances. Fix me");

  const calls = useMemo(() => {
    const contractCalls: any[] = [];
    Log.module("app").debug(`Fetching token balances for ${tokensToLoad.length} tokens, for address ${address}`);
    for (const t of tokensToLoad) {
      contractCalls.push({
        address: t.address as `0x{string}`,
        abi: TokenBalanceABI,
        functionName: "balanceOf",
        args: [address]
      });
    }
    return contractCalls;

    // eslint-disable-next-line react-hooks/exhaustive-deps -- doing just tokensToLoad doesn't work and causes multiple calls
  }, [address, tokensToLoad.map((t) => t.symbol).join()]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<Record<string, TokenValue>, Error>(
    ["token", "balance"],
    async () => {
      if (!address) return {};
      const res = (await multicall({
        contracts: calls,
        allowFailure: true
      })) as unknown as BigNumber[];
      const balances: Record<string, TokenValue> = {};

      for (let i = 0; i < res.length; i++) {
        const value = res[i];
        const token = tokensToLoad[i];
        balances[token.symbol] = token.fromBlockchain(value);

        // set the balance in the query cache too
        queryClient.setQueryData(["token", "balance", token.symbol], { [token.symbol]: balances[token.symbol] });
      }

      const ETH = tokens.ETH;
      if (ETH) {
        const ethBalance = await ETH.getBalance(address);
        Log.module("app").debug(`ETH balance: `, ethBalance.toHuman());
        queryClient.setQueryData(["token", "balance", "ETH"], { ETH: ethBalance });
        balances.ETH = ethBalance;
      }

      return balances;
    },
    {
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 30
    }
  );

  return { data, isLoading, isFetching, error, refetch };
};
