import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Field, FieldDailySnapshot, FieldHourlySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";
import { ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function takeFieldSnapshots(field: Field, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();

  const hour = BigInt.fromI32(hourFromTimestamp(block.timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));

  // Load the snapshot for this season/day
  const hourlyId = field.id.toHexString() + "-" + currentSeason.toString();
  const dailyId = field.id.toHexString() + "-" + day.toString();
  let baseHourly = FieldHourlySnapshot.load(hourlyId);
  let baseDaily = FieldDailySnapshot.load(dailyId);
  if (baseHourly == null && field.lastHourlySnapshotSeason !== 0) {
    baseHourly = FieldHourlySnapshot.load(field.id.toHexString() + "-" + field.lastHourlySnapshotSeason.toString());
  }
  if (baseDaily == null && field.lastDailySnapshotDay !== null) {
    baseDaily = FieldDailySnapshot.load(field.id.toHexString() + "-" + field.lastDailySnapshotDay!.toString());
  }
  const hourly = new FieldHourlySnapshot(hourlyId);
  const daily = new FieldDailySnapshot(dailyId);

  // Set current values
  hourly.season = currentSeason;
  hourly.field = field.id;
  hourly.temperature = field.temperature;
  hourly.realRateOfReturn = field.realRateOfReturn;
  hourly.numberOfSowers = field.numberOfSowers;
  hourly.numberOfSows = field.numberOfSows;
  hourly.sownBeans = field.sownBeans;
  hourly.unharvestablePods = field.unharvestablePods;
  hourly.harvestablePods = field.harvestablePods;
  hourly.harvestedPods = field.harvestedPods;
  hourly.soil = field.soil;
  // issuedSoil set below, on initial snapshot
  hourly.podIndex = field.podIndex;
  hourly.harvestableIndex = field.harvestableIndex;
  hourly.podRate = field.podRate;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaTemperature = hourly.temperature - baseHourly.temperature;
    hourly.deltaRealRateOfReturn = hourly.realRateOfReturn.minus(baseHourly.realRateOfReturn);
    hourly.deltaNumberOfSowers = hourly.numberOfSowers - baseHourly.numberOfSowers;
    hourly.deltaNumberOfSows = hourly.numberOfSows - baseHourly.numberOfSows;
    hourly.deltaSownBeans = hourly.sownBeans.minus(baseHourly.sownBeans);
    hourly.deltaUnharvestablePods = hourly.unharvestablePods.minus(baseHourly.unharvestablePods);
    hourly.deltaHarvestablePods = hourly.harvestablePods.minus(baseHourly.harvestablePods);
    hourly.deltaHarvestedPods = hourly.harvestedPods.minus(baseHourly.harvestedPods);
    hourly.deltaSoil = hourly.soil.minus(baseHourly.soil);
    // deltaIssuedSoil set below, on initial snapshot
    hourly.deltaPodIndex = hourly.podIndex.minus(baseHourly.podIndex);
    hourly.deltaHarvestableIndex = hourly.harvestableIndex.minus(baseHourly.harvestableIndex);
    hourly.deltaPodRate = hourly.podRate.minus(baseHourly.podRate);

    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaTemperature = hourly.deltaTemperature + baseHourly.deltaTemperature;
      hourly.deltaRealRateOfReturn = hourly.deltaRealRateOfReturn.plus(baseHourly.deltaRealRateOfReturn);
      hourly.deltaNumberOfSowers = hourly.deltaNumberOfSowers + baseHourly.deltaNumberOfSowers;
      hourly.deltaNumberOfSows = hourly.deltaNumberOfSows + baseHourly.deltaNumberOfSows;
      hourly.deltaSownBeans = hourly.deltaSownBeans.plus(baseHourly.deltaSownBeans);
      hourly.deltaUnharvestablePods = hourly.deltaUnharvestablePods.plus(baseHourly.deltaUnharvestablePods);
      hourly.deltaHarvestablePods = hourly.deltaHarvestablePods.plus(baseHourly.deltaHarvestablePods);
      hourly.deltaHarvestedPods = hourly.deltaHarvestedPods.plus(baseHourly.deltaHarvestedPods);
      hourly.deltaSoil = hourly.deltaSoil.plus(baseHourly.deltaSoil);
      hourly.deltaPodIndex = hourly.deltaPodIndex.plus(baseHourly.deltaPodIndex);
      hourly.deltaHarvestableIndex = hourly.deltaHarvestableIndex.plus(baseHourly.deltaHarvestableIndex);
      hourly.deltaPodRate = hourly.deltaPodRate.plus(baseHourly.deltaPodRate);
      // Carry over unset values that would otherwise get erased
      hourly.issuedSoil = baseHourly.issuedSoil;
      hourly.deltaIssuedSoil = baseHourly.deltaIssuedSoil;
      hourly.seasonBlock = baseHourly.seasonBlock;
      hourly.caseId = baseHourly.caseId;
      hourly.soilSoldOut = baseHourly.soilSoldOut;
      hourly.blocksToSoldOutSoil = baseHourly.blocksToSoldOutSoil;
    } else {
      // Sets initial creation values
      hourly.issuedSoil = field.soil;
      hourly.deltaIssuedSoil = field.soil.minus(baseHourly.issuedSoil);
      hourly.seasonBlock = block.number;
      hourly.soilSoldOut = false;
    }
  } else {
    hourly.deltaTemperature = hourly.temperature;
    hourly.deltaRealRateOfReturn = hourly.realRateOfReturn;
    hourly.deltaNumberOfSowers = hourly.numberOfSowers;
    hourly.deltaNumberOfSows = hourly.numberOfSows;
    hourly.deltaSownBeans = hourly.sownBeans;
    hourly.deltaUnharvestablePods = hourly.unharvestablePods;
    hourly.deltaHarvestablePods = hourly.harvestablePods;
    hourly.deltaHarvestedPods = hourly.harvestedPods;
    hourly.deltaSoil = hourly.soil;
    hourly.deltaPodIndex = hourly.podIndex;
    hourly.deltaHarvestableIndex = hourly.harvestableIndex;
    hourly.deltaPodRate = hourly.podRate;

    // Sets initial creation values
    hourly.issuedSoil = field.soil;
    hourly.deltaIssuedSoil = field.soil;
    hourly.seasonBlock = block.number;
    hourly.soilSoldOut = false;
  }
  hourly.createdAt = hour.times(BigInt.fromU32(3600));
  hourly.updatedAt = block.timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.field = field.id;
  daily.temperature = field.temperature;
  daily.realRateOfReturn = field.realRateOfReturn;
  daily.numberOfSowers = field.numberOfSowers;
  daily.numberOfSows = field.numberOfSows;
  daily.sownBeans = field.sownBeans;
  daily.unharvestablePods = field.unharvestablePods;
  daily.harvestablePods = field.harvestablePods;
  daily.harvestedPods = field.harvestedPods;
  daily.soil = field.soil;
  // issuedSoil set below, on initial snapshot
  daily.podIndex = field.podIndex;
  daily.harvestableIndex = field.harvestableIndex;
  daily.podRate = field.podRate;
  if (baseDaily !== null) {
    daily.deltaTemperature = daily.temperature - baseDaily.temperature;
    daily.deltaRealRateOfReturn = daily.realRateOfReturn.minus(baseDaily.realRateOfReturn);
    daily.deltaNumberOfSowers = daily.numberOfSowers - baseDaily.numberOfSowers;
    daily.deltaNumberOfSows = daily.numberOfSows - baseDaily.numberOfSows;
    daily.deltaSownBeans = daily.sownBeans.minus(baseDaily.sownBeans);
    daily.deltaUnharvestablePods = daily.unharvestablePods.minus(baseDaily.unharvestablePods);
    daily.deltaHarvestablePods = daily.harvestablePods.minus(baseDaily.harvestablePods);
    daily.deltaHarvestedPods = daily.harvestedPods.minus(baseDaily.harvestedPods);
    daily.deltaSoil = daily.soil.minus(baseDaily.soil);
    // deltaIssuedSoil set below, on initial snapshot
    daily.deltaPodIndex = daily.podIndex.minus(baseDaily.podIndex);
    daily.deltaHarvestableIndex = daily.harvestableIndex.minus(baseDaily.harvestableIndex);
    daily.deltaPodRate = daily.podRate.minus(baseDaily.podRate);

    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaTemperature = daily.deltaTemperature + baseDaily.deltaTemperature;
      daily.deltaRealRateOfReturn = daily.deltaRealRateOfReturn.plus(baseDaily.deltaRealRateOfReturn);
      daily.deltaNumberOfSowers = daily.deltaNumberOfSowers + baseDaily.deltaNumberOfSowers;
      daily.deltaNumberOfSows = daily.deltaNumberOfSows + baseDaily.deltaNumberOfSows;
      daily.deltaSownBeans = daily.deltaSownBeans.plus(baseDaily.deltaSownBeans);
      daily.deltaUnharvestablePods = daily.deltaUnharvestablePods.plus(baseDaily.deltaUnharvestablePods);
      daily.deltaHarvestablePods = daily.deltaHarvestablePods.plus(baseDaily.deltaHarvestablePods);
      daily.deltaHarvestedPods = daily.deltaHarvestedPods.plus(baseDaily.deltaHarvestedPods);
      daily.deltaSoil = daily.deltaSoil.plus(baseDaily.deltaSoil);
      daily.deltaPodIndex = daily.deltaPodIndex.plus(baseDaily.deltaPodIndex);
      daily.deltaHarvestableIndex = daily.deltaHarvestableIndex.plus(baseDaily.deltaHarvestableIndex);
      daily.deltaPodRate = daily.deltaPodRate.plus(baseDaily.deltaPodRate);
      // Carry over existing values
      daily.issuedSoil = baseDaily.issuedSoil;
      daily.deltaIssuedSoil = baseDaily.deltaIssuedSoil;
    } else {
      // Sets issued soil here since this is the initial creation
      daily.issuedSoil = field.soil;
      daily.deltaIssuedSoil = field.soil.minus(baseDaily.issuedSoil);
    }
  } else {
    daily.deltaTemperature = daily.temperature;
    daily.deltaRealRateOfReturn = daily.realRateOfReturn;
    daily.deltaNumberOfSowers = daily.numberOfSowers;
    daily.deltaNumberOfSows = daily.numberOfSows;
    daily.deltaSownBeans = daily.sownBeans;
    daily.deltaUnharvestablePods = daily.unharvestablePods;
    daily.deltaHarvestablePods = daily.harvestablePods;
    daily.deltaHarvestedPods = daily.harvestedPods;
    daily.deltaSoil = daily.soil;
    daily.deltaPodIndex = daily.podIndex;
    daily.deltaHarvestableIndex = daily.harvestableIndex;
    daily.deltaPodRate = daily.podRate;

    // Sets issued soil here since this is the initial creation
    daily.issuedSoil = field.soil;
    daily.deltaIssuedSoil = field.soil;
  }
  daily.createdAt = day.times(BigInt.fromU32(86400));
  daily.updatedAt = block.timestamp;
  daily.save();

  field.lastHourlySnapshotSeason = currentSeason;
  field.lastDailySnapshotDay = day;
}

export function clearFieldDeltas(field: Field, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));
  const hourly = FieldHourlySnapshot.load(field.id.toHexString() + "-" + currentSeason.toString());
  const daily = FieldDailySnapshot.load(field.id.toHexString() + "-" + day.toString());
  if (hourly != null) {
    hourly.deltaTemperature = 0;
    hourly.deltaRealRateOfReturn = ZERO_BD;
    hourly.deltaNumberOfSowers = 0;
    hourly.deltaNumberOfSows = 0;
    hourly.deltaSownBeans = ZERO_BI;
    hourly.deltaUnharvestablePods = ZERO_BI;
    hourly.deltaHarvestablePods = ZERO_BI;
    hourly.deltaHarvestedPods = ZERO_BI;
    hourly.deltaSoil = ZERO_BI;
    hourly.deltaPodIndex = ZERO_BI;
    hourly.deltaHarvestableIndex = ZERO_BI;
    hourly.deltaPodRate = ZERO_BD;
    hourly.deltaIssuedSoil = ZERO_BI;
    hourly.save();
  }
  if (daily != null) {
    daily.deltaTemperature = 0;
    daily.deltaRealRateOfReturn = ZERO_BD;
    daily.deltaNumberOfSowers = 0;
    daily.deltaNumberOfSows = 0;
    daily.deltaSownBeans = ZERO_BI;
    daily.deltaUnharvestablePods = ZERO_BI;
    daily.deltaHarvestablePods = ZERO_BI;
    daily.deltaHarvestedPods = ZERO_BI;
    daily.deltaSoil = ZERO_BI;
    daily.deltaPodIndex = ZERO_BI;
    daily.deltaHarvestableIndex = ZERO_BI;
    daily.deltaPodRate = ZERO_BD;
    daily.deltaIssuedSoil = ZERO_BI;
    daily.save();
  }
}

// Set case id on hourly. Snapshot must have already been created.
export function setFieldHourlyCaseId(caseId: BigInt, field: Field): void {
  const hourly = FieldHourlySnapshot.load(field.id.toHexString() + "-" + field.lastHourlySnapshotSeason.toString())!;
  hourly.caseId = caseId;
  hourly.save();
}

// Set soil sold out info on the hourly. Snapshot must have already been created.
export function setHourlySoilSoldOut(soldOutBlock: BigInt, field: Field): void {
  const hourly = FieldHourlySnapshot.load(field.id.toHexString() + "-" + field.lastHourlySnapshotSeason.toString())!;
  hourly.blocksToSoldOutSoil = soldOutBlock.minus(hourly.seasonBlock);
  hourly.soilSoldOut = true;
  hourly.save();
}
