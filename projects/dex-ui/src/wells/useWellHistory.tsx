import { Well } from "@beanstalk/sdk/Wells";

import { Token, TokenValue } from "@beanstalk/sdk";

import { useChainScopedQuery } from "src/utils/query/useChainScopedQuery";
import useSdk from "src/utils/sdk/useSdk";

import { loadHistory } from "./historyLoader";

export enum EVENT_TYPE {
  SWAP,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SYNC,
  SHIFT
}

export type BaseEvent = {
  type: EVENT_TYPE;
  tx: string;
  timestamp?: number;
  block?: number;
};

export type ShiftEvent = BaseEvent & {
  toToken: Token;
  toAmount: TokenValue;
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

export type WellEvent = SwapEvent | AddEvent | RemoveEvent | ShiftEvent;

const useWellHistory = (well: Well) => {
  const sdk = useSdk();

  return useChainScopedQuery({
    queryKey: ["wells", "history", well.address],

    queryFn: async () => {
      const data = await loadHistory(sdk, well);

      return data;
    },

    staleTime: 1000 * 60
  });
};

export default useWellHistory;
