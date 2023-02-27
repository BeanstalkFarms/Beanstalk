import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import BigNumber from 'bignumber.js';

export type WellSwap = {
  hash: string;
  label: string;
  account: string;
  amountIn: BigNumber;
  tokenIn: {
    name: string;
    symbol: string;
    decimals: number;
  };
  amountOut: BigNumber;
  tokenOut: {
    name: string;
    symbol: string;
    decimals: number;
  };
  timestamp: string;
};

const useWellSwaps = (wellId: string) => {
  const WELLS_SWAP_QUERY = gql`
    query GetWellSwaps($id: ID!) {
      well(id: $id) {
        swaps {
          hash
          account {
            id
          }
          amountIn
          amountOut
          toToken {
            name
            decimals
            symbol
          }
          fromToken {
            name
            decimals
            symbol
          }
          timestamp
        }
      }
    }
  `;

  type SwapQueryResult = {
    well: {
      swaps: [
        {
          hash: string;
          account: {
            id: string;
          };
          amountIn: string;
          amountOut: string;
          toToken: {
            decimals: number;
            name: string;
            symbol: string;
          };
          fromToken: {
            decimals: number;
            name: string;
            symbol: string;
          };
          timestamp: string;
        }
      ];
    };
  };

  type SwapQueryVariables = {
    id: string;
  };

  const { loading, error, data } = useQuery<
    SwapQueryResult,
    SwapQueryVariables
  >(WELLS_SWAP_QUERY, {
    variables: { id: wellId },
    context: { subgraph: 'beanstalk-wells', fetchPolicy: 'cache-and-network' },
  });

  const [swaps, setSwaps] = useState<WellSwap[]>([]);

  useEffect(() => {
    if (!loading && data) {
      setSwaps(
        data.well.swaps.map((swap) => ({
          hash: swap.hash,
          label: `Swap ${swap.fromToken.name} for ${swap.toToken.name}`,
          account: swap.account.id,
          amountIn: new BigNumber(swap.amountIn),
          tokenIn: {
            name: swap.fromToken.name,
            symbol: swap.fromToken.symbol,
            decimals: swap.fromToken.decimals,
          },
          amountOut: new BigNumber(swap.amountOut),
          tokenOut: {
            name: swap.toToken.name,
            symbol: swap.toToken.symbol,
            decimals: swap.toToken.decimals,
          },
          timestamp: swap.timestamp,
        }))
      );
    }
  }, [loading, data]);

  return {
    swaps,
    error,
    loading,
  };
};

export default useWellSwaps;
