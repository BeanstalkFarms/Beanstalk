import { DexSettings } from ".";

export const ProdSettings: DexSettings = {
  PRODUCTION: true,
  AQUIFER_ADDRESS_MAINNET: import.meta.env.VITE_AQUIFER_ADDRESS_MAINNET,
  AQUIFER_ADDRESS_ARBITRUM: import.meta.env.VITE_AQUIFER_ADDRESS_ARBITRUM,
  SUBGRAPH_URL: "https://graph.node.bean.money/subgraphs/name/basin",
  BEANSTALK_SUBGRAPH_URL: "https://graph.node.bean.money/subgraphs/name/beanstalk",
  WELLS_ORIGIN_BLOCK: 17977922,
  LOAD_HISTORY_FROM_GRAPH: true
};

if (!ProdSettings.AQUIFER_ADDRESS_MAINNET) {
  throw new Error("AQUIFER_ADDRESS_MAINNET is not set");
}
if (!ProdSettings.AQUIFER_ADDRESS_ARBITRUM) {
  throw new Error("AQUIFER_ADDRESS_ARBITRUM is not set");
}
