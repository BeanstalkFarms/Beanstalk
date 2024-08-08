import { Address, BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { Field, Plot } from "../../generated/schema";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { ADDRESS_ZERO, BEANSTALK, CURVE_PRICE } from "../../../subgraph-core/utils/Constants";
import { CurvePrice } from "../../generated/Beanstalk-ABIs/CurvePrice";
import { BeanstalkPrice_try_price } from "./contracts/BeanstalkPrice";
import { loadBeanstalk, loadSeason } from "./Beanstalk";
import { setHourlyCaseId, takeFieldSnapshots } from "./snapshots/Field";

// This function is for handling both the WeatherChange and TemperatureChange events.
// The logic is the same for both, this is intended to accommodate the renamed event and fields.
export function handleRateChange(protocol: Address, evtBlock: ethereum.Block, season: BigInt, caseId: BigInt, absChange: i32): void {
  let field = loadField(protocol);
  field.temperature += absChange;

  let seasonEntity = loadSeason(protocol, season);
  let currentPrice = ZERO_BD;
  if (seasonEntity.price != ZERO_BD) {
    currentPrice = seasonEntity.price;
  } else {
    // Attempt to pull from Beanstalk Price contract first
    let beanstalkQuery = BeanstalkPrice_try_price(protocol, evtBlock.number);
    if (beanstalkQuery.reverted) {
      let curvePrice = CurvePrice.bind(CURVE_PRICE);
      currentPrice = toDecimal(curvePrice.getCurve().price);
    } else {
      currentPrice = toDecimal(beanstalkQuery.value.price);
    }
  }

  field.realRateOfReturn = ONE_BD.plus(BigDecimal.fromString((field.temperature / 100).toString())).div(currentPrice);

  takeFieldSnapshots(field, protocol, evtBlock.timestamp, evtBlock.number);
  field.save();

  // Set caseId on the hourly snapshot
  setHourlyCaseId(caseId, field, protocol);
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

export function getHarvestableIndex(protocol: Address): BigInt {
  let bs = loadBeanstalk(protocol);
  let season = loadSeason(protocol, BigInt.fromI32(bs.lastSeason));
  return season.harvestableIndex;
}

export function loadPlot(diamondAddress: Address, index: BigInt): Plot {
  let plot = Plot.load(index.toString());
  if (plot == null) {
    plot = new Plot(index.toString());
    plot.field = diamondAddress.toHexString();
    plot.farmer = ADDRESS_ZERO.toHexString();
    plot.source = "SOW"; // Should be overwritten in case of a transfer creating a new plot
    plot.sourceHash = "";
    plot.season = 0;
    plot.creationHash = "";
    plot.createdAt = ZERO_BI;
    plot.updatedAt = ZERO_BI;
    plot.updatedAtBlock = ZERO_BI;
    plot.index = index;
    plot.pods = ZERO_BI;
    plot.beansPerPod = ZERO_BI;
    plot.harvestablePods = ZERO_BI;
    plot.harvestedPods = ZERO_BI;
    plot.fullyHarvested = false;
    plot.save();

    let field = loadField(diamondAddress);
    field.plotIndexes.push(plot.index);
    field.save();
  }
  return plot;
}
