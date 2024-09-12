import { BigInt } from "@graphprotocol/graph-ts";
import { Reward, Soil, WellOracle, Sunrise, Incentivization, SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { toDecimal, ZERO_BD } from "../../../subgraph-core/utils/Decimals";
import { updateStalkWithCalls } from "../utils/legacy/LegacySilo";
import { loadBeanstalk, loadSeason } from "../entities/Beanstalk";
import { getBeanstalkPrice } from "../utils/contracts/BeanstalkPrice";
import { takeFieldSnapshots } from "../entities/snapshots/Field";
import { loadField } from "../entities/Field";
import { updateBeanEMA } from "../utils/Yield";
import { updateExpiredPlots } from "../utils/Marketplace";
import { updateHarvestablePlots } from "../utils/Field";
import { siloReceipt, sunrise } from "../utils/Season";
import { isGaugeDeployed, isReplanted } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "../utils/constants/Version";
import { Receipt, Shipped } from "../../generated/Beanstalk-ABIs/Reseed";

export function handleSunrise(event: Sunrise): void {
  // (Legacy) Update any farmers that had silo transfers from the prior season.
  // This is intentionally done before beanstalk.lastSeason gets updated
  updateStalkWithCalls(event.address, event.block);

  sunrise(event.address, event.params.season, event.block);
}

// Overall reward mint
export function handleShipped(event: Shipped): void {
  let season = loadSeason(event.params.season);
  season.rewardBeans = event.params.shipmentAmount;
  season.save();
}

// Reward mint to each shipment
export function handleReceipt(event: Receipt): void {
  if (event.params.recipient == 1) {
    siloReceipt(event.params.receivedAmount, event.block);
  }
}

export function handleWellOracle(event: WellOracle): void {
  let season = loadSeason(event.params.season);
  season.deltaB = season.deltaB.plus(event.params.deltaB);
  if (isGaugeDeployed(v(), event.block.number) && season.price == ZERO_BD) {
    let beanstalkPrice = getBeanstalkPrice(event.block.number);
    let beanstalkQuery = beanstalkPrice.getConstantProductWell(event.params.well);
    season.price = toDecimal(beanstalkQuery.price);
  }
  season.save();
}

export function handleSoil(event: Soil): void {
  let field = loadField(event.address);
  field.season = event.params.season.toI32();
  field.soil = event.params.soil;

  takeFieldSnapshots(field, event.block);
  field.save();

  if (isReplanted(v(), event.params.season)) {
    updateBeanEMA(event.address, event.block.timestamp);
  }
}

// This is the final function to be called during sunrise both pre and post replant
export function handleIncentive(event: Incentivization): void {
  // Update market cap for season
  let beanstalk = loadBeanstalk();
  let beanstalk_contract = SeedGauge.bind(event.address);
  let season = loadSeason(BigInt.fromI32(beanstalk.lastSeason));

  season.marketCap = season.price.times(toDecimal(season.beans));
  season.incentiveBeans = event.params.beans;
  // TODO: need legacy extraction here for providing no field id
  season.harvestableIndex = beanstalk_contract.harvestableIndex();
  season.save();

  updateExpiredPlots(season.harvestableIndex, event.block);
  updateHarvestablePlots(event.address, season.harvestableIndex, event.block);
}
