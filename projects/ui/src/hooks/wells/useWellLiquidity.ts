import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import BigNumber from 'bignumber.js';

enum LIQUIDITY_EVENT_TYPE {
  ADD,
  REMOVE,
}

type LiquidityToken = {
  amount: BigNumber;
  name: string;
  symbol: string;
  id: string;
  decimals: number;
};

export type WellLiquidityEvent = {
  type: 'ADD' | 'REMOVE';
  hash: string;
  label: string;
  account: string;

  // Will be IN if ADD LIQUIDITY, OUT if REMOVE LIQUIDITY
  lpAmount: BigNumber;
  tokenAmounts: LiquidityToken[];

  amountUSD: string;
  timestamp: string;
};

const useWellLiquidity = (wellId: string) => {
  const WELLS_LIQUIDITY_QUERY = gql`
    query GetWellLiquidityEvents($id: ID!) {
      well: well(id: $id) {
        deposits {
          hash
          account {
            id
          }
          amountUSD
          timestamp
          tokens {
            id
            name
            symbol
            decimals
          }
          liquidity
          reserves
        }
        withdraws {
          hash
          account {
            id
          }
          amountUSD
          timestamp
          tokens {
            id
            name
            symbol
            decimals
          }
          liquidity
          reserves
        }
      }
    }
  `;

  type LiquidityType = {
    hash: string;
    account: {
      id: string;
    };
    amountUSD: string;
    timestamp: string;
    tokens: {
      id: string;
      name: string;
      symbol: string;
      decimals: number;
    }[];
    liquidity: string;
    reserves: string;
  };

  type LiquidityQueryResult = {
    well: {
      deposits: LiquidityType[];
      withdraws: LiquidityType[];
    };
  };

  type LiquidityQueryVariables = {
    id: string;
  };

  const { loading, error, data } = useQuery<
    LiquidityQueryResult,
    LiquidityQueryVariables
  >(WELLS_LIQUIDITY_QUERY, {
    variables: { id: wellId },
    context: { subgraph: 'beanstalk-wells', fetchPolicy: 'cache-and-network' },
  });

  const [deposits, setDeposits] = useState<WellLiquidityEvent[]>([]);
  const [withdraws, setWithdraws] = useState<WellLiquidityEvent[]>([]);

  // @ts-ignore
  const concatTokensForLabel = (tokens) => {
    // @ts-ignore
    return tokens.map((t) => t.symbol).join(' ');
  };

  useEffect(() => {
    if (!loading && data) {
      setDeposits(
        data.well.deposits.map((deposit) => ({
          type: 'ADD',
          hash: deposit.hash,
          label: `Deposit ${deposit.amountUSD} ${concatTokensForLabel(
            deposit.tokens
          )}`, // TODO: Different label?
          account: deposit.account.id,
          lpAmount: new BigNumber(deposit.liquidity),
          tokenAmounts: deposit.tokens.map((token, i) => ({
            amount: new BigNumber(deposit.reserves[i]),
            name: token.name,
            symbol: token.symbol,
            id: token.id,
            decimals: token.decimals,
          })),
          timestamp: deposit.timestamp,
          amountUSD: deposit.amountUSD,
        }))
      );

      setWithdraws(
        data.well.withdraws.map((withdraw) => ({
          type: 'REMOVE',
          hash: withdraw.hash,
          label: `Withdraw ${withdraw.amountUSD} ${concatTokensForLabel(
            withdraw.tokens
          )}`, // TODO: Different label?
          account: withdraw.account.id,
          lpAmount: new BigNumber(withdraw.liquidity),
          tokenAmounts: withdraw.tokens.map((token, i) => ({
            amount: new BigNumber(withdraw.reserves[i]),
            name: token.name,
            symbol: token.symbol,
            id: token.id,
            decimals: token.decimals,
          })),
          timestamp: withdraw.timestamp,
          amountUSD: withdraw.amountUSD,
        }))
      );
    }
  }, [loading, data]);

  return {
    deposits,
    withdraws,
    error,
    loading,
  };
};

export default useWellLiquidity;
