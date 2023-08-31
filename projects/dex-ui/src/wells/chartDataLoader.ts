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

  let results: any[] = [];
  let goToNextPage: boolean = false;
  let nextPage: number = 0;
  let skipAmount: number = 0;

  do {
    const data = fetchFromSubgraphRequest(GetWellChartDataDocument, {
      id: well.address,
      lastUpdateTimestamp_gte: HISTORY_DAYS_AGO_BLOCK_TIMESTAMP,
      resultsToSkip: skipAmount
    });

    const fetchedData = await data();

    if (fetchedData.well) {
      results = results.concat(fetchedData.well.hourlySnapshots)
      if (fetchedData.well.hourlySnapshots.length === 1000) {
        goToNextPage = true;
        nextPage++;
        skipAmount = nextPage * 1000;
      } else {
        goToNextPage = false;
      }
    } else {
      goToNextPage = false;
    }
  }

  while (goToNextPage === true);

  return results;
};

export const loadChartData = async (sdk: BeanstalkSDK, well: Well, timePeriod: string): Promise<any> => {
  return loadFromGraph(sdk, well, timePeriod);
};
