import { SiloYield } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";

export function loadSiloYield(season: i32): SiloYield {
  let siloYield = SiloYield.load(season.toString());
  if (siloYield == null) {
    siloYield = new SiloYield(season.toString());
    siloYield.season = season;
    siloYield.beta = ZERO_BD;
    siloYield.u = 0;
    siloYield.beansPerSeasonEMA = ZERO_BD;
    siloYield.zeroSeedBeanAPY = ZERO_BD;
    siloYield.twoSeedBeanAPY = ZERO_BD;
    siloYield.twoSeedStalkAPY = ZERO_BD;
    siloYield.threeSeedBeanAPY = ZERO_BD;
    siloYield.threeSeedStalkAPY = ZERO_BD;
    siloYield.threePointTwoFiveSeedBeanAPY = ZERO_BD;
    siloYield.threePointTwoFiveSeedStalkAPY = ZERO_BD;
    siloYield.fourSeedBeanAPY = ZERO_BD;
    siloYield.fourSeedStalkAPY = ZERO_BD;
    siloYield.fourPointFiveSeedBeanAPY = ZERO_BD;
    siloYield.fourPointFiveSeedStalkAPY = ZERO_BD;
    siloYield.createdAt = ZERO_BI;
    siloYield.save();
  }
  return siloYield as SiloYield;
}
