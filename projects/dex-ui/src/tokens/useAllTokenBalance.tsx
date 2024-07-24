import { TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useTokens } from "./TokenProvider";
import { Log } from "src/utils/logger";
import { config } from "src/utils/wagmi/config";
<<<<<<< HEAD
=======
import { ContractFunctionParameters } from "viem";
import { queryKeys } from "src/utils/query/queryKeys";
>>>>>>> master

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

const MAX_PER_CALL = 20;

export const useAllTokensBalance = () => {
  const tokens = useTokens();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const tokensToLoad = Object.values(tokens).filter((t) => t.symbol !== "ETH");

  const calls = useMemo(() => {
    const contractCalls: ContractFunctionParameters[][] = [];
    Log.module("app").debug(
      `Fetching token balances for ${tokensToLoad.length} tokens, for address ${address}`
    );

    let callBucket: ContractFunctionParameters[] = [];

    tokensToLoad.forEach((token, i) => {
      callBucket.push({
        address: token.address as `0x{string}`,
        abi: TokenBalanceABI,
        functionName: "balanceOf",
        args: [address]
      });

      if (i % MAX_PER_CALL === MAX_PER_CALL - 1) {
        contractCalls.push([...callBucket]);
        callBucket = [];
      }
    });
    return contractCalls;

    // eslint-disable-next-line react-hooks/exhaustive-deps -- doing just tokensToLoad doesn't work and causes multiple calls
  }, [address, tokensToLoad.map((t) => t.symbol).join()]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
<<<<<<< HEAD
    queryKey: ["token", "balance"],

    queryFn: async () => {
      if (!address) return {};
      const res = (await multicall(config, {
        contracts: calls,
        allowFailure: false
      })) as unknown as BigNumber[];
=======
    queryKey: queryKeys.tokenBalancesAll,
    queryFn: async () => {
      if (!address) return {};

      const ETH = tokens.ETH;

      const [ethBalance, ...results] = await Promise.all([
        ETH.getBalance(address),
        ...(calls.map((calls) =>
          multicall(config, { contracts: calls, allowFailure: false })
        ) as unknown as BigNumber[])
      ]);

      const res = results.flat();
>>>>>>> master
      const balances: Record<string, TokenValue> = {};

      if (ethBalance) {
        Log.module("app").debug(`ETH balance: `, ethBalance.toHuman());
        queryClient.setQueryData(queryKeys.tokenBalance(ETH.symbol), { ETH: ethBalance });
        balances.ETH = ethBalance;
      }

      for (let i = 0; i < res.length; i++) {
        const value = res[i];
        const token = tokensToLoad[i];
        balances[token.symbol] = token.fromBlockchain(value);

        // set the balance in the query cache too
<<<<<<< HEAD
        queryClient.setQueryData(["token", "balance", token.symbol], { [token.symbol]: balances[token.symbol] });

      }

      const ETH = tokens.ETH;
      if (ETH) {
        const ethBalance = await ETH.getBalance(address);
        Log.module("app").debug(`ETH balance: `, ethBalance.toHuman());
        queryClient.setQueryData(["token", "balance", "ETH"], { ETH: ethBalance });
        balances.ETH = ethBalance;
=======
        queryClient.setQueryData(queryKeys.tokenBalance(token.symbol), {
          [token.symbol]: balances[token.symbol]
        });
>>>>>>> master
      }

      return balances;
    },
<<<<<<< HEAD

=======
    enabled: !!address && !!tokensToLoad.length,
>>>>>>> master
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30
  });

  return { data, isLoading, isFetching, error, refetch };
};
