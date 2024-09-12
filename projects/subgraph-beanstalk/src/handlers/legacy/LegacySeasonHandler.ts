import { BigDecimal } from "@graphprotocol/graph-ts";
import { REPLANT_SEASON } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { toDecimal } from "../../../../subgraph-core/utils/Decimals";
import { SeasonSnapshot, Sunrise as Sunrise_PreReplant } from "../../../generated/Beanstalk-ABIs/PreReplant";
import { MetapoolOracle, Sunrise as Sunrise_Replanted } from "../../../generated/Beanstalk-ABIs/Replanted";
import { BeanstalkPrice_priceOnly } from "../../utils/contracts/BeanstalkPrice";
import { loadSeason } from "../../entities/Beanstalk";
import { updateStalkWithCalls } from "../../utils/legacy/LegacySilo";
import { siloReceipt, sunrise } from "../../utils/Season";
import { Reward } from "../../../generated/Beanstalk-ABIs/SeedGauge";

// PreReplant -> Replanted
export function handleSunrise_v1(event: Sunrise_PreReplant): void {
  // (Legacy) Update any farmers that had silo transfers from the prior season.
  // This is intentionally done before beanstalk.lastSeason gets updated
  updateStalkWithCalls(event.address, event.block);

  sunrise(event.address, event.params.season, event.block);
}

// Replanted -> SiloV3
export function handleReplantSunrise(event: Sunrise_Replanted): void {
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
  season.price = toDecimal(BeanstalkPrice_priceOnly(event.block.number));
  season.deltaB = event.params.deltaB;
  season.save();
}

// Replanted -> SeedGauge
export function handleReward(event: Reward): void {
  let season = loadSeason(event.params.season);
  season.rewardBeans = event.params.toField.plus(event.params.toSilo).plus(event.params.toFertilizer);
  season.save();

  siloReceipt(event.params.toSilo, event.block);
}
