import { TokenValue } from "@beanstalk/sdk";
import { Log } from "src/utils/logger";
import { BeanstalkSiloLatestApyDocument } from "src/generated/graph/graphql";
import { fetchFromSubgraphRequest } from "./subgraphFetch";

export type SiloAPYResult = {
  id: string;
  season: number;
  zeroSeedBeanAPY: TokenValue;
  twoSeedBeanAPY: TokenValue;
  threeSeedBeanAPY: TokenValue;
  threePointTwoFiveSeedBeanAPY: TokenValue;
  fourSeedBeanAPY: TokenValue;
  fourPointFiveSeedBeanAPY: TokenValue;
  beansPerSeasonEMA: TokenValue;
};

const defaultResult: SiloAPYResult = {
  id: "",
  season: 0,
  zeroSeedBeanAPY: TokenValue.ZERO,
  twoSeedBeanAPY: TokenValue.ZERO,
  fourSeedBeanAPY: TokenValue.ZERO,
  threeSeedBeanAPY: TokenValue.ZERO,
  threePointTwoFiveSeedBeanAPY: TokenValue.ZERO,
  fourPointFiveSeedBeanAPY: TokenValue.ZERO,
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
          return {
            id: datum.id,
            season: datum.season,
            zeroSeedBeanAPY: normalise(datum.zeroSeedBeanAPY),
            twoSeedBeanAPY: normalise(datum.twoSeedBeanAPY),
            fourSeedBeanAPY: normalise(datum.fourSeedBeanAPY),
            threeSeedBeanAPY: normalise(datum.threeSeedBeanAPY),
            threePointTwoFiveSeedBeanAPY: normalise(datum.threePointTwoFiveSeedBeanAPY),
            fourPointFiveSeedBeanAPY: normalise(datum.fourPointFiveSeedBeanAPY),
            beansPerSeasonEMA: normalise(datum.beansPerSeasonEMA)
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
