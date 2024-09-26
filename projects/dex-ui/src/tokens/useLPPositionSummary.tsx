import { useCallback, useEffect, useMemo, useState } from "react";

import BEANSTALK_ABI from "@beanstalk/protocol/abi/Beanstalk.json";
import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import { ContractFunctionParameters, erc20Abi } from "viem";
import { useAccount } from "wagmi";

import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk-wells";

import { Log } from "src/utils/logger";
import { queryKeys } from "src/utils/query/queryKeys";
import { useScopedQuery, useSetScopedQueryData } from "src/utils/query/useScopedQuery";
import useSdk from "src/utils/sdk/useSdk";
import { config } from "src/utils/wagmi/config";

import { useFarmerWellsSiloBalances } from "./useSiloBalance";
import { useWellLPTokens } from "./useWellLPTokens";

type TokenBalanceCache = undefined | void | Record<string, TokenValue>;

export type LPBalanceSummary = {
  silo: TokenValue;
  external: TokenValue;
  internal: TokenValue;
  total: TokenValue;
};

type TokenMap<T> = { [tokenSymbol: string]: T };

/**
 * Contract calls to fetch internal & external balances
 * Only fetch balances for wells with a defined LP Token
 */
const makeMultiCall = (
  sdk: BeanstalkSDK,
  lpTokens: Token[],
  account: `0x${string}` | undefined
) => {
  const contractCalls: ContractFunctionParameters[] = [];
  if (!account) return contractCalls;
  Log.module("useLPPositionSummary").debug(
    `Fetching internal & external token balances for ${lpTokens.length} lp tokens for address ${account}`
  );

  for (const t of lpTokens) {
    contractCalls.push({
      address: t.address as `0x{string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account]
    });
    contractCalls.push({
      address: sdk.contracts.beanstalk.address as `0x{string}`,
      abi: BEANSTALK_ABI as Readonly<ContractFunctionParameters["abi"]>,
      functionName: "getInternalBalance",
      args: [account, t.address]
    });
  }

  return contractCalls;
};

const CALLS_PER_TOKEN = 2;

export const useLPPositionSummary = () => {
  const setQueryData = useSetScopedQueryData();
  const lpTokens = useWellLPTokens();
  const { address } = useAccount();
  const sdk = useSdk();

  const [positions, setPositions] = useState<TokenMap<LPBalanceSummary>>({});

  // Array of LP tokens for each well

  /**
   * Silo Balances
   */
  const { data: siloBalances, ...siloBalanceRest } = useFarmerWellsSiloBalances();

  /**
   * Fetch external & internal balances
   */
  const { data: balanceData, ...balanceRest } = useScopedQuery({
    queryKey: queryKeys.lpSummaryAll,
    queryFn: async () => {
      /**
       * TODO: check if there are any cached balances.
       * If so, return those instead of fetching
       */
      const balances: Record<string, Omit<LPBalanceSummary, "silo">> = {};
      if (!address || !lpTokens.length) return balances;

      const res = (await multicall(config, {
        contracts: makeMultiCall(sdk, lpTokens, address),
        allowFailure: false
      })) as unknown[] as BigNumber[];

      for (let i = 0; i < res.length; i++) {
        // divide by 2 to get the index of the lp token b/c we have 2 calls per token

        const lpTokenIndex = Math.floor(i / CALLS_PER_TOKEN);
        const lpToken = lpTokens[lpTokenIndex];
        let balance = balances?.[lpToken.address] || {
          external: TokenValue.ZERO,
          internal: TokenValue.ZERO
        };

        /// update the cache object & update useQuery cache
        if (i % 2 === 0) {
          if (lpTokens[lpTokenIndex]) {
            balance.external = lpTokens[lpTokenIndex].fromBlockchain(res[i]) || TokenValue.ZERO;
          }
          setQueryData(queryKeys.tokenBalance(lpToken.address), (oldData: TokenBalanceCache) => {
            if (!oldData) return { [lpToken.address]: balance.external };
            return { ...oldData, [lpToken.address]: balance.external };
          });
          setQueryData(queryKeys.tokenBalancesAll, (oldData: TokenBalanceCache) => {
            if (!oldData) return { [lpToken.address]: balance.external };
            return { ...oldData, [lpToken.address]: balance.external };
          });
        } else {
          if (lpTokens[lpTokenIndex]) {
            balance.internal = lpTokens[lpTokenIndex].fromBlockchain(res[i]);
            setQueryData(
              queryKeys.tokenBalanceInternal(lpToken.address),
              (oldData: TokenBalanceCache) => {
                if (!oldData) return { [lpToken.address]: balance.internal };
                return { ...oldData, [lpToken.address]: balance.internal };
              }
            );
          }
        }

        balances[lpToken.address] = balance;
      }

      return balances;
    },
    enabled: !!address && !!lpTokens.length,

    /**
     * Token balances are cached for 30 seconds, refetch value every 30 seconds,
     * when the window is hidden/not visible, stop background refresh,
     * when the window gains focus, force a refresh even if cache is not stale     *
     */
    staleTime: 1000 * 30,
    retry: false,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always"
  });

  // Combine silo, internal & external balances & update state
  useEffect(() => {
    // console.log("balanceData: ", balanceData);
    // console.log("lpTokens: ", lpTokens);
    if (!lpTokens.length || !balanceData) return;

    const map = lpTokens.reduce<TokenMap<LPBalanceSummary>>((memo, curr) => {
      const siloBalance = siloBalances?.[curr.address] || TokenValue.ZERO;
      const internalExternal = balanceData?.[curr.address] || {
        external: TokenValue.ZERO,
        internal: TokenValue.ZERO
      };

      memo[curr.address] = {
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
      if (!well?.lpToken?.address) return undefined;
      return positions?.[well.lpToken.address];
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
