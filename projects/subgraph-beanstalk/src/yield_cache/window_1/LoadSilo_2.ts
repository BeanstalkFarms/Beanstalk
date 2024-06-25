import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { DiamondCut } from "../../../generated/Diamond/Beanstalk";
import { loadBeanstalk } from "../../utils/Beanstalk";
import { loadSiloYield } from "../../utils/SiloEntities";
import { SILO_YIELD_24_HOUR_15_000 } from "./HistoricSilo_15_000";

export function handleLoadSilo1_2(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  // Load the historical vAPY figures in bulk at start
  if (beanstalk.lastUpgrade == ZERO_BI) {
    loadSiloCache();
  }
}

function loadSiloCache(): void {
  for (let i = 0; i < SILO_YIELD_24_HOUR_15_000.length; i++) {
    let season = <i32>parseInt(SILO_YIELD_24_HOUR_15_000[i][0]);
    let window = <i32>parseInt(SILO_YIELD_24_HOUR_15_000[i][5]);
    let siloYield = loadSiloYield(season, window);

    siloYield.beta = BigDecimal.fromString(SILO_YIELD_24_HOUR_15_000[i][1]);
    siloYield.u = <i32>parseInt(SILO_YIELD_24_HOUR_15_000[i][2]);
    siloYield.beansPerSeasonEMA = BigDecimal.fromString(SILO_YIELD_24_HOUR_15_000[i][3]);
    siloYield.createdAt = BigInt.fromString(SILO_YIELD_24_HOUR_15_000[i][4]);
    siloYield.save();
  }
}
