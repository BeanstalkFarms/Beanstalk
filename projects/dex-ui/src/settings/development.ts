import { DexSettings, BASE_SUBGRAPH_URL as BASE_URL } from ".";

export const DevSettings: DexSettings = {
  PRODUCTION: false,
  SUBGRAPH_URL: `${BASE_URL}/basin`,
  SUBGRAPH_URL_ETH: `${BASE_URL}/basin_eth`,
  BEANSTALK_SUBGRAPH_URL: `${BASE_URL}/beanstalk`,
  BEANSTALK_SUBGRAPH_URL_ETH: `${BASE_URL}/beanstalk_eth`,
  WELLS_ORIGIN_BLOCK: parseInt(import.meta.env.VITE_WELLS_ORIGIN_BLOCK) || 17977922,
  LOAD_HISTORY_FROM_GRAPH: !!parseInt(import.meta.env.VITE_LOAD_HISTORY_FROM_GRAPH) || false
};
