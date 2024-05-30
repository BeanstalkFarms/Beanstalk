import { Address, BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { Field, FieldDailySnapshot, FieldHourlySnapshot } from "../../generated/schema";
import { dayFromTimestamp } from "./Dates";
import { BI_MAX, ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BEANSTALK, BEANSTALK_PRICE, CURVE_PRICE } from "../../../subgraph-core/utils/Constants";
import { loadSeason } from "./Season";
import { CurvePrice } from "../../generated/Field/CurvePrice";
import { BeanstalkPrice } from "../../generated/Field/BeanstalkPrice";

// This function is for handling both the WeatherChange and TemperatureChange events.
// The logic is the same for both, this is intended to accommodate the renamed event and fields.
export function handleRateChange(evtAddress: Address, evtBlock: ethereum.Block, season: BigInt, caseId: BigInt, absChange: i32): void {
  let field = loadField(evtAddress);
  let fieldHourly = loadFieldHourly(evtAddress, season.toI32(), evtBlock.timestamp);
  let fieldDaily = loadFieldDaily(evtAddress, evtBlock.timestamp);

  field.temperature += absChange;
  fieldHourly.temperature += absChange;
  fieldDaily.temperature += absChange;

  fieldHourly.caseId = caseId;

  // Real Rate of Return

  let seasonEntity = loadSeason(evtAddress, season);

  let currentPrice = ZERO_BD;
  if (seasonEntity.price != ZERO_BD) {
    currentPrice = seasonEntity.price;
  } else {
    // Attempt to pull from Beanstalk Price contract first
    let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
    let beanstalkQuery = beanstalkPrice.try_price();
    if (beanstalkQuery.reverted) {
      let curvePrice = CurvePrice.bind(CURVE_PRICE);
      currentPrice = toDecimal(curvePrice.getCurve().price);
    } else {
      currentPrice = toDecimal(beanstalkQuery.value.price);
    }
  }

  field.realRateOfReturn = ONE_BD.plus(BigDecimal.fromString((field.temperature / 100).toString())).div(currentPrice);
  fieldHourly.realRateOfReturn = field.realRateOfReturn;
  fieldHourly.realRateOfReturn = field.realRateOfReturn;

  field.save();
  fieldHourly.save();
  fieldDaily.save();
}

export function loadField(account: Address): Field {
  let field = Field.load(account.toHexString());
  if (field == null) {
    field = new Field(account.toHexString());
    field.beanstalk = BEANSTALK.toHexString();
    if (account !== BEANSTALK) {
      field.farmer = account.toHexString();
    }
    field.season = 1;
    field.temperature = 1;
    field.realRateOfReturn = ZERO_BD;
    field.numberOfSowers = 0;
    field.numberOfSows = 0;
    field.sownBeans = ZERO_BI;
    field.plotIndexes = [];
    field.unharvestablePods = ZERO_BI;
    field.harvestablePods = ZERO_BI;
    field.harvestedPods = ZERO_BI;
    field.soil = ZERO_BI;
    field.podIndex = ZERO_BI;
    field.podRate = ZERO_BD;
    field.save();
  }
  return field;
}

export function loadFieldHourly(account: Address, season: i32, timestamp: BigInt): FieldHourlySnapshot {
  // Hourly for Beanstalk is assumed to be by season. To keep other data correctly divided
  // by season, we elect to use the season number for the hour number.
  let id = account.toHexString() + "-" + season.toString();
  let hourly = FieldHourlySnapshot.load(id);
  if (hourly == null) {
    let field = loadField(account);
    hourly = new FieldHourlySnapshot(id);
    hourly.field = field.id;
    hourly.season = season;
    hourly.temperature = field.temperature;
    hourly.realRateOfReturn = ZERO_BD;
    hourly.podIndex = field.podIndex;
    hourly.deltaNumberOfSowers = 0;
    hourly.numberOfSowers = field.numberOfSowers;
    hourly.deltaNumberOfSows = 0;
    hourly.numberOfSows = field.numberOfSows;
    hourly.deltaSownBeans = ZERO_BI;
    hourly.sownBeans = field.sownBeans;
    hourly.deltaUnharvestablePods = ZERO_BI;
    hourly.unharvestablePods = field.unharvestablePods;
    hourly.deltaHarvestablePods = ZERO_BI;
    hourly.harvestablePods = field.harvestablePods;
    hourly.deltaHarvestedPods = ZERO_BI;
    hourly.harvestedPods = field.harvestedPods;
    hourly.issuedSoil = ZERO_BI;
    hourly.soil = ZERO_BI;
    hourly.podRate = field.podRate;
    hourly.blocksToSoldOutSoil = ZERO_BI;
    hourly.soilSoldOut = false;
    hourly.caseId = BI_MAX;
    hourly.blockNumber = ZERO_BI;
    hourly.createdAt = timestamp;
    hourly.updatedAt = timestamp;
    hourly.save();
  }
  return hourly;
}

export function loadFieldDaily(account: Address, timestamp: BigInt): FieldDailySnapshot {
  let hour = dayFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + hour.toString();
  let daily = FieldDailySnapshot.load(id);
  if (daily == null) {
    let field = loadField(account);
    daily = new FieldDailySnapshot(id);
    daily.field = field.id;
    daily.season = field.season;
    daily.temperature = field.temperature;
    daily.realRateOfReturn = ZERO_BD;
    daily.podIndex = field.podIndex;
    daily.deltaNumberOfSowers = 0;
    daily.numberOfSowers = field.numberOfSowers;
    daily.deltaNumberOfSows = 0;
    daily.numberOfSows = field.numberOfSows;
    daily.deltaSownBeans = ZERO_BI;
    daily.sownBeans = field.sownBeans;
    daily.deltaUnharvestablePods = ZERO_BI;
    daily.unharvestablePods = field.unharvestablePods;
    daily.deltaHarvestablePods = ZERO_BI;
    daily.harvestablePods = field.harvestablePods;
    daily.deltaHarvestedPods = ZERO_BI;
    daily.harvestedPods = field.harvestedPods;
    daily.issuedSoil = ZERO_BI;
    daily.soil = ZERO_BI;
    daily.podRate = field.podRate;
    daily.createdAt = timestamp;
    daily.updatedAt = timestamp;
    daily.save();
  }
  return daily;
}
