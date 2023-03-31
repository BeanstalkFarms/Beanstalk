import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery } from "@tanstack/react-query";
import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useTokens } from "./TokenProvider";

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

export const useTokenBalance = (token?: Token) => {
  const tokens = useTokens();
  const { address } = useAccount();

  const tokensToLoad = useMemo(() => (token ? [token] : Object.values(tokens)), [token, tokens]);
  if (tokensToLoad.length > 20) throw new Error("Too many tokens to load balances. Fix me");

  const calls = useMemo(() => {
    const contractCalls: any[] = [];
    for (const t of tokensToLoad) {
      contractCalls.push({
        address: t.address as `0x{string}`,
        abi: TokenBalanceABI,
        functionName: "balanceOf",
        args: [address]
      });
    }
    return contractCalls;
  }, [address, tokensToLoad]);

  const { data, isLoading, error, refetch } = useQuery<Record<string, TokenValue>, Error>(
    ["token", "balance", "all"],
    async () => {
      console.log(`Multicall: Getting balances for ${tokensToLoad.length} tokens`);
      const res = (await multicall({
        contracts: calls,
        allowFailure: true
      })) as unknown as BigNumber[];

      const balances: Record<string, TokenValue> = {};

      for (let i = 0; i < res.length; i++) {
        const value = res[i];
        const token = tokensToLoad[i];
        balances[token.symbol] = token.fromBlockchain(value);
      }

      return balances;
    },
    {
      staleTime: 1000 * 30
    }
  );

  // let result = token ? data?.[token.symbol] : data;

  return { data, isLoading, error, refetch };
};
