import { FertilizerYield } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";

export function loadFertilizerYield(season: i32, window: i32): FertilizerYield {
  let fertilizerYield = FertilizerYield.load(season.toString() + "-" + window.toString());
  if (fertilizerYield == null) {
    fertilizerYield = new FertilizerYield(season.toString() + "-" + window.toString());
    fertilizerYield.season = season;
    fertilizerYield.humidity = ZERO_BD;
    fertilizerYield.outstandingFert = ZERO_BI;
    fertilizerYield.beansPerSeasonEMA = ZERO_BD;
    fertilizerYield.deltaBpf = ZERO_BD;
    fertilizerYield.simpleAPY = ZERO_BD;
    fertilizerYield.createdAt = ZERO_BI;

    if (window == 24) {
      fertilizerYield.window = "ROLLING_24_HOUR";
    } else if (window == 168) {
      fertilizerYield.window = "ROLLING_7_DAY";
    } else if (window == 720) {
      fertilizerYield.window = "ROLLING_30_DAY";
    }

    fertilizerYield.save();
  }
  return fertilizerYield as FertilizerYield;
}
