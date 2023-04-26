import { DexSettings } from ".";

export const DevSettings: DexSettings = {
  AQUIFER_ADDRESS: import.meta.env.VITE_AQUIFER_ADDRESS,
  SUBGRAPH_URL: "http://127.0.0.1:8000/subgraphs/name/beanstalk-wells",
  WELLS_ORIGIN_BLOCK: 16400000
};

if (!DevSettings.AQUIFER_ADDRESS) throw new Error("Missing environment var VITE_AQUIFER_ADDRESS");
