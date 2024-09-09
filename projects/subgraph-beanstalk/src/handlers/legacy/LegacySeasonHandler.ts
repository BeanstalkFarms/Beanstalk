import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { CURVE_PRICE, REPLANT_SEASON } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { toDecimal } from "../../../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../../../generated/Beanstalk-ABIs/CurvePrice";
import { SeasonSnapshot, Sunrise } from "../../../generated/Beanstalk-ABIs/PreReplant";
import { MetapoolOracle } from "../../../generated/Beanstalk-ABIs/Replanted";
import { BeanstalkPrice_try_price } from "../../utils/contracts/BeanstalkPrice";
import { loadSeason } from "../../entities/Beanstalk";
import { updateStalkWithCalls } from "../../utils/legacy/LegacySilo";
import { sunrise } from "../../utils/Season";

// Replanted -> SiloV3
export function handleReplantSunrise(event: Sunrise): void {
  // Update any farmers that had silo transfers from the prior season.
  // This is intentionally done before beanstalk.lastSeason gets updated
  updateStalkWithCalls(event.address, event.block);

  // Replant oracle initialization
  if (event.params.season == REPLANT_SEASON) {
    let seasonEntity = loadSeason(event.params.season);
    seasonEntity.price = BigDecimal.fromString("1.07");
    seasonEntity.save();
  }

  sunrise(event.address, event.params.season, event.block);
}

// PreReplant -> Replanted
export function handleSeasonSnapshot(event: SeasonSnapshot): void {
  let season = loadSeason(event.params.season);
  season.price = toDecimal(event.params.price, 18);
  season.save();
}

// Replanted -> SeedGauge
export function handleMetapoolOracle(event: MetapoolOracle): void {
  let season = loadSeason(event.params.season);
  // Attempt to pull from Beanstalk Price contract first
  let beanstalkQuery = BeanstalkPrice_try_price(event.block.number);
  if (beanstalkQuery.reverted) {
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    season.price = toDecimal(curvePrice.getCurve().price);
  } else {
    season.price = toDecimal(beanstalkQuery.value.price);
  }
  season.deltaB = event.params.deltaB;
  season.save();
}
