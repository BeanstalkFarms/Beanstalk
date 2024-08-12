import { ZERO_BI } from "../../../../../subgraph-core/utils/Decimals";
import { DiamondCut } from "../../../../generated/Beanstalk-ABIs/PreReplant";
import { loadBeanstalk } from "../../../entities/Beanstalk";
import { loadTokenCache } from "../CacheLoader";
import { TOKEN_YIELD_7_DAY_12_000 } from "./HistoricToken_12_000";

export function handleLoadToken2_1(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  // Load the historical vAPY figures in bulk at start
  if (beanstalk.lastUpgrade == ZERO_BI) {
    loadTokenCache(TOKEN_YIELD_7_DAY_12_000);
  }
}
