import { DexSettings } from ".";

// TODO: Temporary settings for previews on new domain. Change to production settings when ready.
export const ProdSettings: DexSettings = {
  PRODUCTION: false,
  AQUIFER_ADDRESS: import.meta.env.VITE_AQUIFER_ADDRESS,
  SUBGRAPH_URL: "http://TBD/subgraphs/name/beanstalk-wells",
  WELLS_ORIGIN_BLOCK: 16400000,
  LOAD_HISTORY_FROM_GRAPH: false
};
