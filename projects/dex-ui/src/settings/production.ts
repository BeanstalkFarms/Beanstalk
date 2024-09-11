import { DexSettings } from ".";

export const ProdSettings: DexSettings = {
  PRODUCTION: true,
  SUBGRAPH_URL: "https://graph.node.bean.money/subgraphs/name/basin",
  BEANSTALK_SUBGRAPH_URL: "https://graph.node.bean.money/subgraphs/name/beanstalk",
  WELLS_ORIGIN_BLOCK: 17977922,
  LOAD_HISTORY_FROM_GRAPH: true
};
