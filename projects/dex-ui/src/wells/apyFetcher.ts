import { TokenValue } from "@beanstalk/sdk";
import { Log } from "src/utils/logger";
import { BeanstalkSiloLatestApyDocument } from "src/generated/graph/graphql";
import { fetchFromSubgraphRequest } from "./subgraphFetch";

export type SiloAPYResult = {
  id: string;
  season: number;
  tokenAPYs: Record<string, TokenValue>;
  beansPerSeasonEMA: TokenValue;
};

const defaultResult: SiloAPYResult = {
  id: "",
  season: 0,
  tokenAPYs: {},
  beansPerSeasonEMA: TokenValue.ZERO
};

const normalise = (data: string | number) => {
  return TokenValue.ZERO.add(parseFloat(typeof data === "string" ? data : data.toString()));
};

const fetchAPYFromSubgraph = async () => {
  Log.module("SiloAPYData").debug("Loading APY data from Graph");
  const fetch = await fetchFromSubgraphRequest(BeanstalkSiloLatestApyDocument, undefined, { useBeanstalkSubgraph: true });

  const result = await fetch()
    .then((response) => {
      if (!response.siloYields.length) return { ...defaultResult };

      return response.siloYields.reduce<SiloAPYResult>(
        (_, datum) => {
          const tokenYields: SiloAPYResult["tokenAPYs"] = {};

          datum.tokenAPYS.forEach((result) => {
            tokenYields[result.token] = normalise(result.beanAPY);
          });

          return {
            id: datum.id,
            season: datum.season,
            beansPerSeasonEMA: normalise(datum.beansPerSeasonEMA),
            tokenAPYs: tokenYields
          };
        },
        { ...defaultResult }
      );
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .catch((e) => {
      // console.error("FAILED TO FETCH SILO APYS: ", e);
      return { ...defaultResult };
    });

  Log.module("SiloAPYData").debug("result: ", result);

  return result;
};

export const loadSiloAPYData = async () => {
  return fetchAPYFromSubgraph();
};
