import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetWellSwapsDocument } from "src/generated/graphql";

import { TokenValue, ERC20Token } from "@beanstalk/sdk";
import { useNetwork } from "wagmi";
import { fetchFromSubgraphRequest } from "./subgraphFetch";

export type WellSwap = {
  hash: string;
  label: string;
  account: string;
  amountIn: TokenValue;
  tokenIn: ERC20Token;
  amountOut: TokenValue;
  tokenOut: ERC20Token;
  timestamp: string;
};

const useWellSwaps = (wellId: string) => {
  const { chain } = useNetwork();

  const {
    isLoading: loading,
    error,
    data
  } = useQuery(
    ["history", "swap", wellId],
    fetchFromSubgraphRequest(GetWellSwapsDocument, {
      id: wellId
    }),
    {
      staleTime: 1000 * 60
    }
  );

  const [swaps, setSwaps] = useState<WellSwap[]>([]);

  useEffect(() => {
    if (!loading && !error && data && chain) {
      setSwaps(
        data.well!.swaps!.map((swap) => ({
          hash: swap.hash,
          label: `Swap ${swap.fromToken.name} for ${swap.toToken.name}`,
          account: swap.account.id,
          amountIn: TokenValue.fromBlockchain(swap.amountIn, swap.fromToken.decimals),
          tokenIn: new ERC20Token(chain.id, swap.fromToken.id, swap.fromToken.decimals, swap.fromToken.symbol, {
            name: swap.fromToken.name
          }),
          amountOut: TokenValue.fromBlockchain(swap.amountOut, swap.toToken.decimals),
          tokenOut: new ERC20Token(chain.id, swap.toToken.id, swap.toToken.decimals, swap.toToken.symbol, { name: swap.toToken.name }),
          timestamp: swap.timestamp
        }))
      );
    }

    if (!loading && error) {
      setSwaps([]);
    }
  }, [loading, data, chain, error]);

  return {
    fetch,
    swaps,
    error,
    loading
  };
};

export default useWellSwaps;
