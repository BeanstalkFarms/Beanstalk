import { Address } from "src/types";
import { DevSettings } from "./development";
import { ProdSettings } from "./production";

export type DexSettings = {
  AQUIFER_ADDRESS: Address;
  SUBGRAPH_URL: string;
  WELLS_ORIGIN_BLOCK: number;
  LOAD_HISTORY_FROM_GRAPH: boolean;
};

export const Settings = import.meta.env.DEV ? DevSettings : ProdSettings;
