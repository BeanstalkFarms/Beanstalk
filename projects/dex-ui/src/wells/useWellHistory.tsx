import { useQuery } from "@tanstack/react-query";
import { GetWellEventsDocument, GetWellEventsQuery, Token as GQLToken } from "src/generated/graphql";

import { TokenValue } from "@beanstalk/sdk";
import { fetchFromSubgraphRequest } from "./subgraphFetch";

export enum EVENT_TYPE {
  SWAP,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY
}

export type WellEvent = {
  type: EVENT_TYPE;
  hash: string;
  totalDollarValue: string;
  label: string;
  timestamp: number;
};

// TODO: Store in env var?
const HISTORY_DAYS = 7;

const useWellHistory = (wellId: string) => {
  const HISTORY_DAYS_AGO_BLOCK_TIMESTAMP = Math.floor(new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).getTime() / 1000);

  const fetcher = async () => {
    console.debug(`Fetching WellEvents for last ${HISTORY_DAYS_AGO_BLOCK_TIMESTAMP} days`);
    const data = await fetchFromSubgraphRequest(GetWellEventsDocument, {
      id: wellId,
      searchTimestamp: HISTORY_DAYS_AGO_BLOCK_TIMESTAMP
    });

    const results = await data();

    let swaps: WellEvent[] = [];
    if (results.well?.swaps) {
      swaps = handleSwapEvents(results);
    }

    let deposits: WellEvent[] = [];
    if (results.well?.deposits) {
      deposits = handleLiquidityEvents(EVENT_TYPE.ADD_LIQUIDITY, results);
    }

    let withdraws: WellEvent[] = [];
    if (results.well?.withdraws) {
      withdraws = handleLiquidityEvents(EVENT_TYPE.REMOVE_LIQUIDITY, results);
    }

    const allData = swaps.concat(deposits).concat(withdraws);
    return allData.sort((a, b) => b.timestamp - a.timestamp);
  };

  const getTokenHumanAmount = (decimals: number, amount: string) =>
    parseFloat(TokenValue.fromBlockchain(amount, decimals).toHuman()).toFixed(0);

  const generateLiquidityLabel = (tokens: GQLToken[], reserves: string[]) => {
    const labels: string[] = [];
    tokens.forEach((token, index) => {
      labels.push(`${getTokenHumanAmount(token.decimals, reserves[index])} ${token.symbol}`);
    });
    return labels.join(" AND ");
  };

  const calculateSwapUSDValue = (amountOut: string, toToken: GQLToken) => {
    const _amountOut = TokenValue.fromBlockchain(amountOut, toToken.decimals);
    const _price = TokenValue.fromHuman(toToken.lastPriceUSD, 2);
    const toTokenValue = _amountOut.mul(_price);
    return toTokenValue;
  };

  const getAmountForLabel = (amount: string, token: GQLToken) => TokenValue.fromBlockchain(amount, token.decimals).toHuman();

  // TODO: Replace with toHuman(format) function
  const tmpFormatDollars = (input: string) => `$${parseFloat(input).toFixed(0)}`;

  const handleSwapEvents = (queryResults: GetWellEventsQuery) => {
    if (!queryResults.well?.swaps || queryResults.well.swaps.length < 1) {
      return [];
    }

    const _swaps = queryResults.well?.swaps;
    return _swaps.map((swap) => ({
      type: EVENT_TYPE.SWAP,
      hash: swap.hash,
      totalDollarValue: tmpFormatDollars(calculateSwapUSDValue(swap.amountOut, swap.toToken).toHuman()),
      label: `${getAmountForLabel(swap.amountIn, swap.fromToken)} ${swap.fromToken.symbol} for ${getAmountForLabel(
        swap.amountOut,
        swap.toToken
      )} ${swap.toToken.symbol}`,
      timestamp: swap.timestamp
    }));
  };

  const handleLiquidityEvents = (type: EVENT_TYPE, queryResult: GetWellEventsQuery) => {
    const events = type === EVENT_TYPE.ADD_LIQUIDITY ? queryResult.well?.deposits : queryResult.well?.withdraws;

    if (!events || events.length < 1) {
      return [];
    }

    return events.map((event) => ({
      type,
      hash: event.hash,
      totalDollarValue: tmpFormatDollars(event.amountUSD),
      label: generateLiquidityLabel(event.tokens, event.reserves),
      timestamp: event.timestamp
    }));
  };

  return useQuery(["wells", "history", wellId], fetcher, {
    staleTime: 1000 * 60
  });
};

export default useWellHistory;
