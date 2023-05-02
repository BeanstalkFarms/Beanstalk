import { DexSettings } from ".";

export const DevSettings: DexSettings = {
  AQUIFER_ADDRESS: import.meta.env.VITE_AQUIFER_ADDRESS,
  SUBGRAPH_URL: "http://127.0.0.1:8000/subgraphs/name/beanstalk-wells",
  WELLS_ORIGIN_BLOCK: parseInt(import.meta.env.VITE_WELLS_ORIGIN_BLOCK) || 16400000,
  LOAD_HISTORY_FROM_GRAPH: !!parseInt(import.meta.env.VITE_LOAD_HISTORY_FROM_GRAPH) || false
};

if (!DevSettings.AQUIFER_ADDRESS) throw new Error("Missing environment var VITE_AQUIFER_ADDRESS");
