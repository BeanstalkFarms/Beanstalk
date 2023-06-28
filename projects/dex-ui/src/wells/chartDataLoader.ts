import { BeanstalkSDK } from "@beanstalk/sdk";
import { fetchFromSubgraphRequest } from "./subgraphFetch";
import { Well } from "@beanstalk/sdk/Wells";
import { GetWellChartDataDocument } from "src/generated/graph/graphql";
import { Log } from "src/utils/logger";

const loadFromGraph = async (sdk: BeanstalkSDK, well: Well, timePeriod: string) => {
  if (!well) return [];

  Log.module("wellChartData").debug("Loading chart data from Graph");

  const HISTORY_DAYS = timePeriod === "day" ? 1 : timePeriod === "month" ? 30 : timePeriod === "week" ? 7 : 0;
  const HISTORY_DAYS_AGO_BLOCK_TIMESTAMP =
    HISTORY_DAYS === 0 ? 0 : Math.floor(new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).getTime() / 1000);

  const data = await fetchFromSubgraphRequest(GetWellChartDataDocument, {
    id: well.address,
    lastUpdateTimestamp_gte: HISTORY_DAYS_AGO_BLOCK_TIMESTAMP
  });

  const results = await data();

  if (!results.well) return [];
  return results.well.hourlySnapshots;
};

export const loadChartData = async (sdk: BeanstalkSDK, well: Well, timePeriod: string): Promise<any> => {
  return loadFromGraph(sdk, well, timePeriod);
};
