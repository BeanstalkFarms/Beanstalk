import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { DiamondCut } from "../../../generated/Diamond/Beanstalk";
import { loadBeanstalk } from "../../utils/Beanstalk";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_30_DAY_15_000 } from "./HistoricSilo_15_000";

export function handleLoadSilo3_2(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  // Load the historical vAPY figures in bulk at start
  if (beanstalk.lastUpgrade == ZERO_BI) {
    loadSiloCache(SILO_YIELD_30_DAY_15_000);
  }
}
