import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Reward, Soil, WellOracle, Sunrise, Incentivization, SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { BEANSTALK, GAUGE_BIP45_BLOCK } from "../../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { updateStalkWithCalls } from "../utils/legacy/LegacySilo";
import { getBeanstalkToken, loadBeanstalk, loadSeason } from "../entities/Beanstalk";
import { takeMarketSnapshots } from "../entities/snapshots/Marketplace";
import { loadSilo, loadSiloAsset } from "../entities/Silo";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { updateDepositInSiloAsset } from "../utils/Silo";
import { getBeanstalkPrice } from "../utils/contracts/BeanstalkPrice";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { takeFieldSnapshots } from "../entities/snapshots/Field";
import { loadField } from "../entities/Field";
import { loadPodMarketplace } from "../entities/PodMarketplace";
import { updateBeanEMA } from "../utils/Yield";
import { updateExpiredPlots } from "../utils/Marketplace";
import { updateHarvestablePlots } from "../utils/Field";

export function handleSunrise(event: Sunrise): void {
  // (Legacy) Update any farmers that had silo transfers from the prior season.
  // This is intentionally done before beanstalk.lastSeason gets updated
  updateStalkWithCalls(event.address, event.block.timestamp);

  let currentSeason = event.params.season.toI32();
  let season = loadSeason(event.address, event.params.season);

  // Update season metrics
  if (event.params.season == BigInt.fromI32(6075)) {
    // Replant oracle initialization
    season.price = BigDecimal.fromString("1.07");
  }
  season.sunriseBlock = event.block.number;
  season.createdAt = event.block.timestamp;
  season.save();

  // Update field metrics
  let field = loadField(event.address);

  // -- Field level totals
  field.season = currentSeason;
  field.podRate = season.beans == ZERO_BI ? ZERO_BD : toDecimal(field.unharvestablePods, 6).div(toDecimal(season.beans, 6));

  takeFieldSnapshots(field, event.address, event.block.timestamp, event.block.number);
  field.save();

  // Marketplace Season Update
  let market = loadPodMarketplace(event.address);
  market.season = currentSeason;
  takeMarketSnapshots(market, event.address, event.block.timestamp);
  market.save();

  // Create silo entities for the protocol
  let silo = loadSilo(event.address);
  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  for (let i = 0; i < silo.whitelistedTokens.length; i++) {
    let siloAsset = loadSiloAsset(event.address, Address.fromString(silo.whitelistedTokens[i]));
    takeSiloAssetSnapshots(siloAsset, event.address, event.block.timestamp);
    siloAsset.save();
  }
  silo.save();
}

export function handleReward(event: Reward): void {
  let season = loadSeason(event.address, event.params.season);
  season.rewardBeans = event.params.toField.plus(event.params.toSilo).plus(event.params.toFertilizer);
  season.save();

  // Add to total Silo Bean mints

  let silo = loadSilo(event.address);
  let newPlantableStalk = event.params.toSilo.times(BigInt.fromI32(10000)); // Stalk has 10 decimals

  silo.beanMints = silo.beanMints.plus(event.params.toSilo);
  silo.stalk = silo.stalk.plus(newPlantableStalk);
  silo.plantableStalk = silo.plantableStalk.plus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.plus(event.params.toSilo);

  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  silo.save();

  updateDepositInSiloAsset(
    event.address,
    event.address,
    getBeanstalkToken(event.address),
    event.params.toSilo,
    event.params.toSilo,
    event.block.timestamp
  );
}

export function handleWellOracle(event: WellOracle): void {
  let season = loadSeason(event.address, event.params.season);
  season.deltaB = season.deltaB.plus(event.params.deltaB);
  if (event.block.number >= GAUGE_BIP45_BLOCK && season.price == ZERO_BD) {
    let beanstalkPrice = getBeanstalkPrice(event.block.number);
    let beanstalkQuery = beanstalkPrice.getConstantProductWell(event.params.well);
    season.price = toDecimal(beanstalkQuery.price);
  }
  season.save();
}

export function handleSoil(event: Soil): void {
  // Replant sets the soil to the amount every season instead of adding new soil
  // to an existing amount.

  let field = loadField(event.address);
  field.season = event.params.season.toI32();
  field.soil = event.params.soil;

  takeFieldSnapshots(field, event.address, event.block.timestamp, event.block.number);
  field.save();

  if (event.params.season.toI32() >= 6075) {
    updateBeanEMA(event.address, event.block.timestamp);
  }
}

// This is the final function to be called during sunrise both pre and post replant
export function handleIncentive(event: Incentivization): void {
  // Update market cap for season
  let beanstalk = loadBeanstalk(event.address);
  let beanstalk_contract = SeedGauge.bind(BEANSTALK);
  let season = loadSeason(event.address, BigInt.fromI32(beanstalk.lastSeason));

  season.marketCap = season.price.times(toDecimal(season.beans));
  season.incentiveBeans = event.params.beans;
  season.harvestableIndex = beanstalk_contract.harvestableIndex();
  season.save();

  updateExpiredPlots(event.address, season.harvestableIndex, event.block.timestamp);
  updateHarvestablePlots(event.address, season.harvestableIndex, event.block.timestamp, event.block.number);
}
