import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { MetapoolOracle, Reward, Soil, WellOracle } from "../generated/Beanstalk-ABIs/BasinBip";
import { CurvePrice } from "../generated/Beanstalk-ABIs/CurvePrice";
import { SeasonSnapshot, Sunrise, Incentivization, PreReplant } from "../generated/Beanstalk-ABIs/PreReplant";
import { Incentive } from "../generated/schema";
import { updateHarvestablePlots } from "./FieldHandler";
import { loadBeanstalk } from "./utils/Beanstalk";
import { Reward as RewardEntity, MetapoolOracle as MetapoolOracleEntity, WellOracle as WellOracleEntity } from "../generated/schema";
import { BEANSTALK, BEAN_ERC20, CURVE_PRICE, GAUGE_BIP45_BLOCK } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadField, loadFieldDaily, loadFieldHourly } from "./utils/Field";
import {
  loadPodMarketplace,
  loadPodMarketplaceDailySnapshot,
  loadPodMarketplaceHourlySnapshot,
  updateExpiredPlots
} from "./utils/PodMarketplace";
import { loadSeason } from "./utils/Season";
import { addDepositToSiloAsset, updateStalkWithCalls } from "./SiloHandler";
import { updateBeanEMA } from "./YieldHandler";
import {
  loadSilo,
  loadSiloDailySnapshot,
  loadSiloHourlySnapshot,
  loadSiloAssetDailySnapshot,
  loadSiloAssetHourlySnapshot
} from "./utils/SiloEntities";
import { BeanstalkPrice_try_price, getBeanstalkPrice } from "./utils/BeanstalkPrice";

export function handleSunrise(event: Sunrise): void {
  let currentSeason = event.params.season.toI32();
  let season = loadSeason(event.address, event.params.season);

  // Update any farmers that had silo transfers from the prior season
  updateStalkWithCalls(currentSeason - 1, event.block.timestamp, event.block.number);

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
  let fieldHourly = loadFieldHourly(event.address, field.season, event.block.timestamp);
  let fieldDaily = loadFieldDaily(event.address, event.block.timestamp);

  // -- Field level totals
  field.season = currentSeason;
  field.podRate = season.beans == ZERO_BI ? ZERO_BD : toDecimal(field.unharvestablePods, 6).div(toDecimal(season.beans, 6));
  fieldHourly.podRate = field.podRate;
  fieldDaily.season = currentSeason;
  fieldDaily.podRate = field.podRate;

  field.save();
  fieldHourly.save();
  fieldDaily.save();

  // Marketplace Season Update

  let market = loadPodMarketplace(event.address);
  let marketHourly = loadPodMarketplaceHourlySnapshot(event.address, market.season, event.block.timestamp);
  let marketDaily = loadPodMarketplaceDailySnapshot(event.address, event.block.timestamp);
  market.season = currentSeason;
  marketHourly.season = currentSeason;
  marketDaily.season = currentSeason;
  market.save();
  marketHourly.save();
  marketDaily.save();

  // Create silo entities for the protocol
  let silo = loadSilo(event.address);
  loadSiloHourlySnapshot(event.address, currentSeason, event.block.timestamp);
  loadSiloDailySnapshot(event.address, event.block.timestamp);
  for (let i = 0; i < silo.whitelistedTokens.length; i++) {
    loadSiloAssetHourlySnapshot(event.address, Address.fromString(silo.whitelistedTokens[i]), currentSeason, event.block.timestamp);
    loadSiloAssetDailySnapshot(event.address, Address.fromString(silo.whitelistedTokens[i]), event.block.timestamp);
  }
}

export function handleSeasonSnapshot(event: SeasonSnapshot): void {
  let season = loadSeason(event.address, event.params.season);
  season.price = toDecimal(event.params.price, 18);
  season.save();
}

export function handleReward(event: Reward): void {
  let id = "reward-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let reward = new RewardEntity(id);
  reward.hash = event.transaction.hash.toHexString();
  reward.logIndex = event.transactionLogIndex.toI32();
  reward.protocol = event.address.toHexString();
  reward.season = event.params.season.toI32();
  reward.toField = event.params.toField;
  reward.toSilo = event.params.toSilo;
  reward.toFertilizer = event.params.toFertilizer;
  reward.blockNumber = event.block.number;
  reward.createdAt = event.block.timestamp;
  reward.save();

  let season = loadSeason(event.address, event.params.season);
  season.rewardBeans = reward.toField.plus(reward.toSilo).plus(reward.toFertilizer);
  season.save();

  // Add to total Silo Bean mints

  let silo = loadSilo(event.address);
  let siloHourly = loadSiloHourlySnapshot(event.address, season.season, event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  let newPlantableStalk = event.params.toSilo.times(BigInt.fromI32(10000)); // Stalk has 10 decimals

  silo.beanMints = silo.beanMints.plus(event.params.toSilo);
  silo.plantableStalk = silo.plantableStalk.plus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.plus(event.params.toSilo);
  silo.save();

  siloHourly.beanMints = silo.beanMints;
  siloHourly.plantableStalk = silo.plantableStalk;
  siloHourly.depositedBDV = silo.depositedBDV;
  siloHourly.deltaBeanMints = siloHourly.deltaBeanMints.plus(event.params.toSilo);
  siloHourly.deltaPlantableStalk = siloHourly.deltaPlantableStalk.plus(newPlantableStalk);
  siloHourly.deltaDepositedBDV = siloHourly.deltaDepositedBDV.plus(event.params.toSilo);
  siloHourly.save();

  siloDaily.beanMints = silo.beanMints;
  siloDaily.plantableStalk = silo.plantableStalk;
  siloDaily.depositedBDV = silo.depositedBDV;
  siloDaily.deltaBeanMints = siloDaily.deltaBeanMints.plus(event.params.toSilo);
  siloDaily.deltaPlantableStalk = siloDaily.deltaPlantableStalk.plus(newPlantableStalk);
  siloDaily.deltaDepositedBDV = siloDaily.deltaDepositedBDV.plus(event.params.toSilo);
  siloDaily.save();

  addDepositToSiloAsset(
    event.address,
    BEAN_ERC20,
    event.params.season.toI32(),
    event.params.toSilo,
    event.params.toSilo,
    event.block.timestamp,
    event.block.number
  );
}

export function handleMetapoolOracle(event: MetapoolOracle): void {
  let id = "metapoolOracle-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let oracle = new MetapoolOracleEntity(id);
  oracle.hash = event.transaction.hash.toHexString();
  oracle.logIndex = event.transactionLogIndex.toI32();
  oracle.protocol = event.address.toHexString();
  oracle.season = event.params.season.toI32();
  oracle.deltaB = event.params.deltaB;
  oracle.balanceA = event.params.balances[0];
  oracle.balanceB = event.params.balances[1];
  oracle.blockNumber = event.block.number;
  oracle.createdAt = event.block.timestamp;
  oracle.save();

  if (event.block.number < GAUGE_BIP45_BLOCK) {
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
}

export function handleWellOracle(event: WellOracle): void {
  let id = "wellOracle-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let oracle = new WellOracleEntity(id);
  oracle.hash = event.transaction.hash.toHexString();
  oracle.logIndex = event.transactionLogIndex.toI32();
  oracle.protocol = event.address.toHexString();
  oracle.season = event.params.season.toI32();
  oracle.deltaB = event.params.deltaB;
  oracle.cumulativeReserves = event.params.cumulativeReserves;
  oracle.blockNumber = event.block.number;
  oracle.createdAt = event.block.timestamp;
  oracle.save();

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
  let fieldHourly = loadFieldHourly(event.address, event.params.season.toI32(), event.block.timestamp);
  let fieldDaily = loadFieldDaily(event.address, event.block.timestamp);

  field.season = event.params.season.toI32();
  field.soil = event.params.soil;
  field.save();

  fieldHourly.soil = field.soil;
  fieldHourly.issuedSoil = fieldHourly.issuedSoil.plus(event.params.soil);
  fieldHourly.updatedAt = event.block.timestamp;
  fieldHourly.save();

  fieldDaily.soil = field.soil;
  fieldDaily.issuedSoil = fieldDaily.issuedSoil.plus(event.params.soil);
  fieldDaily.updatedAt = event.block.timestamp;
  fieldDaily.save();

  if (event.params.season.toI32() >= 6075) {
    updateBeanEMA(event.params.season.toI32(), event.block.timestamp);
  }
}

export function handleIncentive(event: Incentivization): void {
  // This is the final function to be called during sunrise both pre and post replant
  let id = "incentive-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let incentive = new Incentive(id);
  incentive.hash = event.transaction.hash.toHexString();
  incentive.logIndex = event.transactionLogIndex.toI32();
  incentive.protocol = event.address.toHexString();
  incentive.caller = event.params.account.toHexString();
  incentive.amount = event.params.beans;
  incentive.blockNumber = event.block.number;
  incentive.createdAt = event.block.timestamp;
  incentive.save();

  // Update market cap for season
  let beanstalk = loadBeanstalk(event.address);
  let beanstalk_contract = PreReplant.bind(BEANSTALK);
  let season = loadSeason(event.address, BigInt.fromI32(beanstalk.lastSeason));

  season.marketCap = season.price.times(toDecimal(season.beans));
  season.incentiveBeans = event.params.beans;
  season.harvestableIndex = beanstalk_contract.harvestableIndex();
  season.save();

  updateExpiredPlots(season.harvestableIndex, event.address, event.block.timestamp);
  updateHarvestablePlots(season.harvestableIndex, event.block.timestamp, event.block.number);
}
