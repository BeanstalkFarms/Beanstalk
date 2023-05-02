import { BeanstalkSDK } from "@beanstalk/sdk";
import { AddEvent, BaseEvent, EVENT_TYPE, SwapEvent, WellEvent } from "./useWellHistory";
import { fetchFromSubgraphRequest } from "./subgraphFetch";
import { Settings } from "src/settings";
import { Well } from "@beanstalk/sdk/Wells";
import isEqual from "lodash/isEqual";
import { BigNumber } from "ethers";
import { GetWellEventsDocument } from "src/generated/graphql";
import { Log } from "src/utils/logger";

const HISTORY_DAYS = 7;
const HISTORY_DAYS_AGO_BLOCK_TIMESTAMP = Math.floor(new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).getTime() / 1000);

const loadFromChain = async (sdk: BeanstalkSDK, well: Well): Promise<any[]> => {
  Log.module("history").debug("Loading history from blockchain");
  const contract = well.contract;
  const addFilter = contract.filters.AddLiquidity();
  const removeFilter = contract.filters.RemoveLiquidity();
  const swapFilter = contract.filters.Swap();

  if (!well.lpToken) await well.getLPToken();

  const combinedFilter = {
    address: contract.address,
    topics: [[swapFilter?.topics?.[0] as string, addFilter?.topics?.[0] as string, removeFilter?.topics?.[0] as string]]
  };

  const getEventType = (topics: string[]) => {
    if (isEqual(addFilter.topics, topics)) return EVENT_TYPE.ADD_LIQUIDITY;
    if (isEqual(removeFilter.topics, topics)) return EVENT_TYPE.REMOVE_LIQUIDITY;
    if (isEqual(swapFilter.topics, topics)) return EVENT_TYPE.SWAP;

    throw new Error("Unknown topics found: " + topics);
  };

  const fromBlock = Number(Settings.WELLS_ORIGIN_BLOCK);
  const toBlock = "latest";
  const events = await contract.queryFilter(combinedFilter, fromBlock, toBlock);

  Log.module("history").debug("Raw event data from blockchain: ", events);

  return events.sort(sortEventsDescByBlock).map((e) => {
    const type = getEventType(e.topics);
    const base: BaseEvent = {
      type,
      tx: e.transactionHash
    };

    if (type === EVENT_TYPE.SWAP) {
      const data = contract.interface.decodeEventLog("Swap", e.data, e.topics);
      const fromToken = well.getTokenByAddress(data.fromToken)!;
      const toToken = well.getTokenByAddress(data.toToken)!;
      const event: SwapEvent = {
        ...base,
        fromToken,
        fromAmount: fromToken.fromBlockchain(data.amountIn),
        toToken,
        toAmount: toToken.fromBlockchain(data.amountOut)
      };
      return event;
    }
    if (type === EVENT_TYPE.ADD_LIQUIDITY) {
      const data = contract.interface.decodeEventLog("AddLiquidity", e.data, e.topics);
      const event: AddEvent = {
        ...base,
        lpAmount: well.lpToken!.fromBlockchain(data.lpAmountOut),
        tokenAmounts: data.tokenAmountsIn.map((bn: BigNumber, i: number) => well.tokens![i].fromBlockchain(bn))
      };
      return event;
    }
    if (type === EVENT_TYPE.REMOVE_LIQUIDITY) {
      const data = contract.interface.decodeEventLog("RemoveLiquidity", e.data, e.topics);
      const event: AddEvent = {
        ...base,
        lpAmount: well.lpToken!.fromBlockchain(data.lpAmountIn),
        tokenAmounts: data.tokenAmountsOut.map((bn: BigNumber, i: number) => well.tokens![i].fromBlockchain(bn))
      };
      return event;
    }
    throw new Error("Should never reach here. Unknown event type: " + type);
  });
};

const loadFromGraph = async (sdk: BeanstalkSDK, well: Well) => {
  Log.module("history").debug("Loading history from Graph");

  if (!well.lpToken) await well.getLPToken();

  const data = await fetchFromSubgraphRequest(GetWellEventsDocument, {
    id: well.address,
    searchTimestamp: HISTORY_DAYS_AGO_BLOCK_TIMESTAMP
  });

  const results = await data();
  Log.module("history").debug("Raw event data from subgraph: ", results);

  const swapEvents = ((results.well ?? {}).swaps ?? []).map((e) => {
    const fromToken = well.getTokenByAddress(e.fromToken.id)!;
    const toToken = well.getTokenByAddress(e.toToken.id)!;
    const event: SwapEvent = {
      timestamp: e.timestamp,
      type: EVENT_TYPE.SWAP,
      tx: e.hash,
      fromToken,
      fromAmount: fromToken.fromBlockchain(e.amountIn),
      toToken,
      toAmount: toToken.fromBlockchain(e.amountOut)
    };
    return event;
  });

  const addEvents = ((results.well ?? {}).deposits ?? []).map((e) => {
    const event: AddEvent = {
      timestamp: e.timestamp,
      type: EVENT_TYPE.ADD_LIQUIDITY,
      tx: e.hash,
      lpAmount: well.lpToken!.fromBlockchain(e.liquidity),
      tokenAmounts: e.reserves.map((bn: BigNumber, i: number) => well.tokens![i].fromBlockchain(bn))
    };
    return event;
  });

  const removeEvents = ((results.well ?? {}).withdraws ?? []).map((e) => {
    const event: AddEvent = {
      timestamp: e.timestamp,
      type: EVENT_TYPE.REMOVE_LIQUIDITY,
      tx: e.hash,
      lpAmount: well.lpToken!.fromBlockchain(e.liquidity),
      tokenAmounts: e.reserves.map((bn: BigNumber, i: number) => well.tokens![i].fromBlockchain(bn))
    };
    return event;
  });

  const allEvents: WellEvent[] = [...swapEvents, ...addEvents, ...removeEvents];
  return allEvents.sort(sortEventsDescByTimestamp);
};

const sortEventsDescByBlock = (a: any, b: any) => {
  const diff = b.blockNumber - a.blockNumber;
  if (diff !== 0) return diff;
  return b.logIndex - a.logIndex;
};

const sortEventsDescByTimestamp = (a: any, b: any) => {
  const diff = parseInt(b.timestamp) - parseInt(a.timestamp);
  return diff;
};

/**
 * In development, use the ENV var LOAD_HISTORY_FROM_GRAPH to decide. If missing
 * it will default to false (ie, load from blockchain)
 *
 * In production, use the Graph but failover to blockchain if there's an error
 */
export const loadHistory = async (sdk: BeanstalkSDK, well: Well): Promise<WellEvent[]> => {
  if (import.meta.env.DEV && !Settings.LOAD_HISTORY_FROM_GRAPH) {
    return loadFromChain(sdk, well);
  }

  return loadFromGraph(sdk, well)
    .catch((err) => {
      Log.module("history").error("Error loading history from subgraph", err);
      Log.module("history").log("Trying blockchain...");
      return loadFromChain(sdk, well);
    })
    .catch((err) => {
      Log.module("history").error("Failed to load history from blockchain too :(", err);
      return [];
    });
};
