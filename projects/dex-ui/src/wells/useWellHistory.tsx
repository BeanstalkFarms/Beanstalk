import { useQuery } from "@tanstack/react-query";
import { GetWellEventsDocument, GetWellEventsQuery, Token as GQLToken } from "src/generated/graphql";

import { Token, TokenValue } from "@beanstalk/sdk";

import useSdk from "src/utils/sdk/useSdk";
import { loadHistory } from "./historyLoader";
import { Well } from "@beanstalk/sdk/Wells";

export enum EVENT_TYPE {
  SWAP,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY
}

export type BaseEvent = {
  type: EVENT_TYPE;
  tx: string;
  timestamp?: number;
};

export type SwapEvent = BaseEvent & {
  fromToken: Token;
  fromAmount: TokenValue;
  toToken: Token;
  toAmount: TokenValue;
};

export type AddEvent = BaseEvent & {
  lpAmount: TokenValue;
  tokenAmounts: TokenValue[];
};
export type RemoveEvent = AddEvent;

export type WellEvent = SwapEvent | AddEvent | RemoveEvent;

const useWellHistory = (well: Well) => {
  const sdk = useSdk();

  return useQuery(
    ["wells", "history", well.address],
    async () => {
      const data = await loadHistory(sdk, well);

      return data;
    },
    {
      staleTime: 1000 * 60
    }
  );
};

export default useWellHistory;
