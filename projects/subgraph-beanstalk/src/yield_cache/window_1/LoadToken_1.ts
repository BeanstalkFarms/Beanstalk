import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { DiamondCut } from "../../../generated/Diamond/Beanstalk";
import { loadBeanstalk } from "../../utils/Beanstalk";
import { loadTokenCache } from "../CacheLoader";
import { TOKEN_YIELD_24_HOUR_12_000 } from "./HistoricToken_12_000";

export function handleLoadToken1_1(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  // Load the historical vAPY figures in bulk at start
  if (beanstalk.lastUpgrade == ZERO_BI) {
    loadTokenCache(TOKEN_YIELD_24_HOUR_12_000);
  }
}
