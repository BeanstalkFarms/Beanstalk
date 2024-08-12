import { CURVE_PRICE } from "../../../../subgraph-core/utils/Constants";
import { toDecimal } from "../../../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../../../generated/Beanstalk-ABIs/CurvePrice";
import { SeasonSnapshot } from "../../../generated/Beanstalk-ABIs/PreReplant";
import { MetapoolOracle } from "../../../generated/Beanstalk-ABIs/Replanted";
import { BeanstalkPrice_try_price } from "../../utils/contracts/BeanstalkPrice";
import { loadSeason } from "../../entities/Beanstalk";

// PreReplant -> Replanted
export function handleSeasonSnapshot(event: SeasonSnapshot): void {
  let season = loadSeason(event.address, event.params.season);
  season.price = toDecimal(event.params.price, 18);
  season.save();
}

// Replanted -> SeedGauge
export function handleMetapoolOracle(event: MetapoolOracle): void {
  let season = loadSeason(event.address, event.params.season);
  // Attempt to pull from Beanstalk Price contract first
  let beanstalkQuery = BeanstalkPrice_try_price(event.address, event.block.number);
  if (beanstalkQuery.reverted) {
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    season.price = toDecimal(curvePrice.getCurve().price);
  } else {
    season.price = toDecimal(beanstalkQuery.value.price);
  }
  season.deltaB = event.params.deltaB;
  season.save();
}
