import { Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";
import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20ABI, useAccount, useQueryClient } from "wagmi";

import useSdk from "src/utils/sdk/useSdk";
import { Log } from "src/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { BigNumber as EthersBN } from "ethers";
import { multicall } from "@wagmi/core";
import BEANSTALK_ABI from "@beanstalk/protocol/abi/Beanstalk.json";
import { useSiloBalanceMany } from "./useSiloBalance";
import { useWells } from "src/wells/useWells";

export type LPBalanceSummary = {
  silo: TokenValue;
  external: TokenValue;
  internal: TokenValue;
  total: TokenValue;
};

type TokenMap<T> = { [tokenSymbol: string]: T };

export const useLPPositionSummary = () => {
  const queryClient = useQueryClient();

  const { data: wells } = useWells();
  const { address } = useAccount();
  const sdk = useSdk();

  const [positions, setPositions] = useState<TokenMap<LPBalanceSummary>>({});

  // Array of LP tokens for each well
  const lpTokens = useMemo(() => {
    const tokens: Token[] = [];
    if (!wells) {
      return tokens;
    } else if (wells instanceof Well) {
      wells.lpToken && tokens.push(wells.lpToken);
    } else {
      wells.forEach((well) => {
        well?.lpToken && tokens.push(well.lpToken);
      });
    }

    return tokens;
  }, [wells]);

  /**
   * Silo Balances
   */
  const { data: siloBalances, ...siloBalanceRest } = useSiloBalanceMany(lpTokens);

  /**
   * Contract calls to fetch internal & external balances
   * Only fetch balances for wells with a defined LP Token
   */
  const calls = useMemo(() => {
    const contractCalls: any[] = [];
    if (!address) return contractCalls;
    Log.module("useLPPositionSummary").debug(
      `Fetching internal & external token balances for ${lpTokens.length} lp tokens for address ${address}`
    );

    for (const t of lpTokens) {
      contractCalls.push({
        address: t.address as `0x{string}`,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [address]
      });
      contractCalls.push({
        address: sdk.contracts.beanstalk.address as `0x{string}`,
        abi: BEANSTALK_ABI,
        functionName: "getInternalBalance",
        args: [address, t.address]
      });
    }

    return contractCalls;
  }, [address, lpTokens, sdk]);

  /**
   * Fetch external & internal balances
   */
  const { data: balanceData, ...balanceRest } = useQuery<Record<string, Omit<LPBalanceSummary, "silo">>, Error>(
    ["token", "lpSummary", ...lpTokens],
    async () => {
      /**
       * TODO: check if there are any cached balances.
       * If so, return those instead of fetching
       */
      const balances: Record<string, Omit<LPBalanceSummary, "silo">> = {};
      if (!address || !lpTokens.length) return balances;

      const res = (await multicall({
        contracts: calls,
        allowFailure: true
      })) as unknown as EthersBN[];

      for (let i = 0; i < res.length; i++) {
        const lpTokenIndex = Math.floor(i / 2);
        const lpToken = lpTokens[lpTokenIndex];
        let balance = balances?.[lpToken.symbol] || {
          external: TokenValue.ZERO,
          internal: TokenValue.ZERO
        };

        /// update the cache object & update useQuery cache
        if (i % 2 === 0) {
          balance.external = lpTokens[lpTokenIndex].fromBlockchain(res[i]);
          queryClient.setQueryData(["token", "balance", lpToken.symbol], { [lpToken.symbol]: balance.external });
        } else {
          balance.internal = lpTokens[lpTokenIndex].fromBlockchain(res[i]);
          queryClient.setQueryData(["token", "internalBalance", lpToken.symbol], { [lpToken.symbol]: balance.internal });
        }
        queryClient.setQueryData(["token", "balance"], (oldData: undefined | void | Record<string, TokenValue>) => {
          if (!oldData) return { [lpToken.symbol]: balance.external };
          return { ...oldData, [lpToken.symbol]: balance.external };
        });

        balances[lpToken.symbol] = balance;
      }

      return balances;
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

  // Combine silo, internal & external balances & update state
  useEffect(() => {
    if (!lpTokens.length || !balanceData || !siloBalances) return;

    const map = lpTokens.reduce<TokenMap<LPBalanceSummary>>((memo, curr) => {
      const siloBalance = siloBalances?.[curr.symbol] || TokenValue.ZERO;
      const internalExternal = balanceData?.[curr.symbol] || {
        external: TokenValue.ZERO,
        internal: TokenValue.ZERO
      };

      memo[curr.symbol] = {
        silo: siloBalance,
        internal: internalExternal.internal,
        external: internalExternal.external,
        total: siloBalance.add(internalExternal.internal).add(internalExternal.external)
      };

      return memo;
    }, {});

    setPositions(map);
  }, [balanceData, lpTokens, siloBalances]);

  /**
   * Refetch balances. Handle refetching both silo & external/internal balances
   */
  const refetch = useCallback(async () => {
    await Promise.all([balanceRest.refetch(), siloBalanceRest.refetch()]);
  }, [balanceRest, siloBalanceRest]);

  /**
   * Returns the LPBalanceSummary for a given well
   */
  const getPositionWithWell = useCallback(
    (well: Well | undefined) => {
      if (!well?.lpToken?.symbol) return undefined;
      return positions?.[well.lpToken.symbol];
    },
    [positions]
  );

  const hasPositions = useMemo(() => {
    if (!positions) return false;

    return Object.entries(positions).some(([_, { total }]) => {
      return total.gt(TokenValue.ZERO);
    });
  }, [positions]);

  return {
    data: positions,
    isLoading: siloBalanceRest.isLoading || balanceRest.isLoading,
    error: siloBalanceRest.error || balanceRest.error,
    refetch: refetch,
    isFetching: siloBalanceRest.isFetching || balanceRest.isFetching,
    getPositionWithWell,
    hasPositions
  };
};
