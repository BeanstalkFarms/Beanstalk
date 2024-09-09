import { Address, BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { CurvePrice } from "../../generated/Beanstalk-ABIs/CurvePrice";
import { BeanstalkPrice_try_price } from "./contracts/BeanstalkPrice";
import { CURVE_PRICE } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10, ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { setFieldHourlyCaseId, setHourlySoilSoldOut, takeFieldSnapshots } from "../entities/snapshots/Field";
import { getCurrentSeason, getHarvestableIndex, loadBeanstalk, loadFarmer, loadSeason } from "../entities/Beanstalk";
import { loadField, loadPlot } from "../entities/Field";
import { expirePodListingIfExists } from "./Marketplace";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

class SowParams {
  event: ethereum.Event;
  account: Address;
  fieldId: BigInt | null;
  index: BigInt;
  beans: BigInt;
  pods: BigInt;
}

class HarvestParams {
  event: ethereum.Event;
  account: Address;
  fieldId: BigInt | null;
  plots: BigInt[];
  beans: BigInt;
}

class PlotTransferParams {
  event: ethereum.Event;
  from: Address;
  to: Address;
  fieldId: BigInt | null;
  index: BigInt;
  amount: BigInt;
}

class TemperatureChangedParams {
  event: ethereum.Event;
  season: BigInt;
  caseId: BigInt;
  absChange: i32;
}

export function sow(params: SowParams): void {
  const protocol = params.event.address;
  let sownBeans = params.beans;
  // Update Farmer Totals
  updateFieldTotals(protocol, params.account, ZERO_BI, sownBeans, params.pods, ZERO_BI, ZERO_BI, ZERO_BI, params.event.block);

  let field = loadField(protocol);
  loadFarmer(params.account);
  let plot = loadPlot(protocol, params.index);

  let newIndexes = field.plotIndexes;
  newIndexes.push(plot.index);
  field.plotIndexes = newIndexes;
  field.save();

  plot.farmer = params.account;
  plot.source = "SOW";
  plot.sourceHash = params.event.transaction.hash.toHexString();
  plot.season = field.season;
  plot.creationHash = params.event.transaction.hash.toHexString();
  plot.createdAt = params.event.block.timestamp;
  plot.updatedAt = params.event.block.timestamp;
  plot.updatedAtBlock = params.event.block.number;
  plot.pods = params.pods;
  plot.beansPerPod = params.beans.times(BI_10.pow(6)).div(plot.pods);
  plot.save();

  incrementSows(protocol, params.account, params.event.block);
}

export function harvest(params: HarvestParams): void {
  const protocol = params.event.address;
  let beanstalk = loadBeanstalk();
  let season = loadSeason(BigInt.fromI32(beanstalk.lastSeason));

  let remainingIndex = ZERO_BI;
  for (let i = 0; i < params.plots.length; i++) {
    // Plot should exist
    let plot = loadPlot(protocol, params.plots[i]);

    expirePodListingIfExists(toAddress(plot.farmer), plot.index, params.event.block);

    let harvestablePods = season.harvestableIndex.minus(plot.index);

    if (harvestablePods >= plot.pods) {
      // Plot fully harvests
      updateFieldTotals(protocol, params.account, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, plot.pods, params.event.block);

      plot.harvestedPods = plot.pods;
      plot.fullyHarvested = true;
      plot.save();
    } else {
      // Plot partially harvests
      updateFieldTotals(protocol, params.account, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, harvestablePods, params.event.block);

      remainingIndex = plot.index.plus(harvestablePods);
      let remainingPods = plot.pods.minus(harvestablePods);

      let remainingPlot = loadPlot(protocol, remainingIndex);
      remainingPlot.farmer = plot.farmer;
      remainingPlot.source = plot.source;
      remainingPlot.sourceHash = plot.sourceHash;
      remainingPlot.season = beanstalk.lastSeason;
      remainingPlot.creationHash = params.event.transaction.hash.toHexString();
      remainingPlot.createdAt = params.event.block.timestamp;
      remainingPlot.updatedAt = params.event.block.timestamp;
      remainingPlot.updatedAtBlock = params.event.block.number;
      remainingPlot.index = remainingIndex;
      remainingPlot.pods = remainingPods;
      remainingPlot.beansPerPod = plot.beansPerPod;
      remainingPlot.save();

      plot.harvestedPods = harvestablePods;
      plot.pods = harvestablePods;
      plot.fullyHarvested = true;
      plot.save();
    }
  }

  // Remove the harvested plot IDs from the field list
  let field = loadField(protocol);
  let newIndexes = field.plotIndexes;
  for (let i = 0; i < params.plots.length; i++) {
    let plotIndex = newIndexes.indexOf(params.plots[i]);
    newIndexes.splice(plotIndex, 1);
    newIndexes.sort();
  }
  if (remainingIndex !== ZERO_BI) {
    newIndexes.push(remainingIndex);
  }
  field.plotIndexes = newIndexes;
  field.save();
}

export function plotTransfer(params: PlotTransferParams): void {
  const protocol = params.event.address;
  const currentHarvestable = getHarvestableIndex();

  // Ensure both farmer entites exist
  loadFarmer(params.from);
  loadFarmer(params.to);

  // Update farmer field data
  updateFieldTotals(
    protocol,
    params.from,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI,
    ZERO_BI.minus(params.amount),
    ZERO_BI,
    ZERO_BI,
    params.event.block,
    false
  );
  updateFieldTotals(protocol, params.to, ZERO_BI, ZERO_BI, ZERO_BI, params.amount, ZERO_BI, ZERO_BI, params.event.block, false);

  let field = loadField(protocol);
  let sortedPlots = field.plotIndexes.sort();

  let sourceIndex = ZERO_BI;

  for (let i = 0; i < sortedPlots.length; i++) {
    // Handle only single comparison for first value of array
    if (i == 0) {
      if (sortedPlots[i] == params.index) {
        sourceIndex = sortedPlots[i];
        break;
      } else {
        continue;
      }
    }
    // Transferred plot matches existing. Start value of zero.
    if (sortedPlots[i] == params.index) {
      sourceIndex = sortedPlots[i];
      break;
    }
    // Transferred plot is in the middle of existing plot. Non-zero start value.
    if (sortedPlots[i - 1] < params.index && params.index < sortedPlots[i]) {
      sourceIndex = sortedPlots[i - 1];
    }
  }

  let sourcePlot = loadPlot(protocol, sourceIndex);
  let sourceEndIndex = sourceIndex.plus(sourcePlot.pods);
  let transferEndIndex = params.index.plus(params.amount);

  // Determines how many of the pods being transferred are harvestable
  const calcHarvestable = (index: BigInt, pods: BigInt, harvestableIndex: BigInt): BigInt => {
    let harvestable = harvestableIndex.minus(index);
    if (harvestable < ZERO_BI) {
      return ZERO_BI;
    } else {
      return harvestable >= pods ? pods : harvestable;
    }
  };

  let transferredHarvestable = calcHarvestable(params.index, params.amount, currentHarvestable);

  // Actually transfer the plots
  if (sourcePlot.pods == params.amount) {
    // Sending full plot
    const isMarket = sourcePlot.source == "MARKET" && sourcePlot.sourceHash == params.event.transaction.hash.toHexString();
    if (!isMarket) {
      sourcePlot.source = "TRANSFER";
      sourcePlot.sourceHash = params.event.transaction.hash.toHexString();
      sourcePlot.beansPerPod = sourcePlot.beansPerPod;
    }
    sourcePlot.farmer = params.to;
    sourcePlot.updatedAt = params.event.block.timestamp;
    sourcePlot.updatedAtBlock = params.event.block.number;
    sourcePlot.save();
  } else if (sourceIndex == params.index) {
    // We are only needing to split this plot once to send
    // Start value of zero
    let remainderIndex = sourceIndex.plus(params.amount);
    let remainderPlot = loadPlot(protocol, remainderIndex);
    sortedPlots.push(remainderIndex);

    const isMarket = sourcePlot.source == "MARKET" && sourcePlot.sourceHash == params.event.transaction.hash.toHexString();
    if (!isMarket) {
      // When sending the start of the plot via market, these cannot be derived from sourcePlot.
      remainderPlot.source = sourcePlot.source;
      remainderPlot.sourceHash = sourcePlot.sourceHash;
      remainderPlot.beansPerPod = sourcePlot.beansPerPod;

      sourcePlot.source = "TRANSFER";
      sourcePlot.sourceHash = params.event.transaction.hash.toHexString();
      sourcePlot.beansPerPod = sourcePlot.beansPerPod;
    }
    sourcePlot.farmer = params.to;
    sourcePlot.updatedAt = params.event.block.timestamp;
    sourcePlot.updatedAtBlock = params.event.block.number;
    sourcePlot.pods = params.amount;
    sourcePlot.harvestablePods = calcHarvestable(sourcePlot.index, sourcePlot.pods, currentHarvestable);
    sourcePlot.save();

    remainderPlot.farmer = params.from;
    remainderPlot.season = field.season;
    remainderPlot.creationHash = params.event.transaction.hash.toHexString();
    remainderPlot.createdAt = params.event.block.timestamp;
    remainderPlot.updatedAt = params.event.block.timestamp;
    remainderPlot.updatedAtBlock = params.event.block.number;
    remainderPlot.index = remainderIndex;
    remainderPlot.pods = sourceEndIndex.minus(transferEndIndex);
    remainderPlot.harvestablePods = calcHarvestable(remainderPlot.index, remainderPlot.pods, currentHarvestable);
    remainderPlot.save();
  } else if (sourceEndIndex == transferEndIndex) {
    // We are only needing to split this plot once to send
    // Non-zero start value. Sending to end of plot
    let toPlot = loadPlot(protocol, params.index);
    sortedPlots.push(params.index);

    sourcePlot.updatedAt = params.event.block.timestamp;
    sourcePlot.updatedAtBlock = params.event.block.number;
    sourcePlot.pods = sourcePlot.pods.minus(params.amount);
    sourcePlot.harvestablePods = calcHarvestable(sourcePlot.index, sourcePlot.pods, currentHarvestable);
    sourcePlot.save();

    const isMarket = toPlot.source == "MARKET" && toPlot.sourceHash == params.event.transaction.hash.toHexString();
    if (!isMarket) {
      toPlot.source = "TRANSFER";
      toPlot.sourceHash = params.event.transaction.hash.toHexString();
      toPlot.beansPerPod = sourcePlot.beansPerPod;
    }
    toPlot.farmer = params.to;
    toPlot.season = field.season;
    toPlot.creationHash = params.event.transaction.hash.toHexString();
    toPlot.createdAt = params.event.block.timestamp;
    toPlot.updatedAt = params.event.block.timestamp;
    toPlot.updatedAtBlock = params.event.block.number;
    toPlot.index = params.index;
    toPlot.pods = params.amount;
    toPlot.harvestablePods = calcHarvestable(toPlot.index, toPlot.pods, currentHarvestable);
    toPlot.save();
  } else {
    // We have to split this plot twice to send
    let remainderIndex = params.index.plus(params.amount);
    let toPlot = loadPlot(protocol, params.index);
    let remainderPlot = loadPlot(protocol, remainderIndex);

    sortedPlots.push(params.index);
    sortedPlots.push(remainderIndex);

    sourcePlot.updatedAt = params.event.block.timestamp;
    sourcePlot.updatedAtBlock = params.event.block.number;
    sourcePlot.pods = params.index.minus(sourcePlot.index);
    sourcePlot.harvestablePods = calcHarvestable(sourcePlot.index, sourcePlot.pods, currentHarvestable);
    sourcePlot.save();

    const isMarket = toPlot.source == "MARKET" && toPlot.sourceHash == params.event.transaction.hash.toHexString();
    if (!isMarket) {
      toPlot.source = "TRANSFER";
      toPlot.sourceHash = params.event.transaction.hash.toHexString();
      toPlot.beansPerPod = sourcePlot.beansPerPod;
    }
    toPlot.farmer = params.to;
    toPlot.season = field.season;
    toPlot.creationHash = params.event.transaction.hash.toHexString();
    toPlot.createdAt = params.event.block.timestamp;
    toPlot.updatedAt = params.event.block.timestamp;
    toPlot.updatedAtBlock = params.event.block.number;
    toPlot.index = params.index;
    toPlot.pods = params.amount;
    toPlot.harvestablePods = calcHarvestable(toPlot.index, toPlot.pods, currentHarvestable);
    toPlot.save();

    remainderPlot.farmer = params.from;
    remainderPlot.source = sourcePlot.source;
    remainderPlot.sourceHash = sourcePlot.sourceHash;
    remainderPlot.season = field.season;
    remainderPlot.creationHash = params.event.transaction.hash.toHexString();
    remainderPlot.createdAt = params.event.block.timestamp;
    remainderPlot.updatedAt = params.event.block.timestamp;
    remainderPlot.updatedAtBlock = params.event.block.number;
    remainderPlot.index = remainderIndex;
    remainderPlot.pods = sourceEndIndex.minus(transferEndIndex);
    remainderPlot.harvestablePods = calcHarvestable(remainderPlot.index, remainderPlot.pods, currentHarvestable);
    remainderPlot.beansPerPod = sourcePlot.beansPerPod;
    remainderPlot.save();
  }
  sortedPlots.sort();
  field.plotIndexes = sortedPlots;
  field.save();

  // Update any harvestable pod amounts
  // No need to shift beanstalk field, only the farmer fields.
  if (transferredHarvestable != ZERO_BI) {
    updateFieldTotals(
      protocol,
      params.from,
      ZERO_BI,
      ZERO_BI,
      ZERO_BI,
      ZERO_BI,
      ZERO_BI.minus(transferredHarvestable),
      ZERO_BI,
      params.event.block,
      false
    );
    updateFieldTotals(protocol, params.to, ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, transferredHarvestable, ZERO_BI, params.event.block, false);
  }
}

// This function is for handling both the WeatherChange and TemperatureChange events.
// The logic is the same for both, this is intended to accommodate the renamed event and fields.
export function temperatureChanged(params: TemperatureChangedParams): void {
  const protocol = params.event.address;
  let field = loadField(protocol);
  field.temperature += params.absChange;

  let seasonEntity = loadSeason(params.season);
  let currentPrice = ZERO_BD;
  if (seasonEntity.price != ZERO_BD) {
    currentPrice = seasonEntity.price;
  } else {
    // Attempt to pull from Beanstalk Price contract first
    let beanstalkQuery = BeanstalkPrice_try_price(params.event.block.number);
    if (beanstalkQuery.reverted) {
      let curvePrice = CurvePrice.bind(CURVE_PRICE);
      currentPrice = toDecimal(curvePrice.getCurve().price);
    } else {
      currentPrice = toDecimal(beanstalkQuery.value.price);
    }
  }

  field.realRateOfReturn = ONE_BD.plus(BigDecimal.fromString((field.temperature / 100).toString())).div(currentPrice);

  takeFieldSnapshots(field, params.event.block);
  field.save();

  // Set caseId on the hourly snapshot
  setFieldHourlyCaseId(params.caseId, field);
}

export function updateFieldTotals(
  protocol: Address,
  account: Address,
  soil: BigInt,
  sownBeans: BigInt,
  sownPods: BigInt,
  transferredPods: BigInt,
  harvestablePods: BigInt,
  harvestedPods: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateFieldTotals(protocol, protocol, soil, sownBeans, sownPods, transferredPods, harvestablePods, harvestedPods, block);
  }
  let field = loadField(account);

  field.season = getCurrentSeason();
  field.soil = field.soil.plus(soil).minus(sownBeans);
  field.sownBeans = field.sownBeans.plus(sownBeans);
  field.unharvestablePods = field.unharvestablePods.plus(sownPods).minus(harvestablePods).plus(transferredPods);
  field.harvestablePods = field.harvestablePods.plus(harvestablePods);
  field.harvestedPods = field.harvestedPods.plus(harvestedPods);
  field.podIndex = field.podIndex.plus(sownPods);

  takeFieldSnapshots(field, block);
  field.save();

  // Set extra info on the hourly snapshot
  if (field.soil == ZERO_BI) {
    setHourlySoilSoldOut(block.number, field);
  }
}

export function updateHarvestablePlots(protocol: Address, harvestableIndex: BigInt, block: ethereum.Block): void {
  let field = loadField(protocol);
  let sortedIndexes = field.plotIndexes.sort();

  for (let i = 0; i < sortedIndexes.length; i++) {
    if (sortedIndexes[i] > harvestableIndex) {
      break;
    }
    let plot = loadPlot(protocol, sortedIndexes[i]);

    // Plot is fully harvestable, but hasn't been harvested yet
    if (plot.harvestablePods == plot.pods) {
      continue;
    }

    let harvestablePods = harvestableIndex.minus(plot.index);
    let oldHarvestablePods = plot.harvestablePods;
    plot.harvestablePods = harvestablePods >= plot.pods ? plot.pods : harvestablePods;
    plot.save();

    let deltaHarvestablePods = oldHarvestablePods == ZERO_BI ? plot.harvestablePods : plot.harvestablePods.minus(oldHarvestablePods);

    updateFieldTotals(protocol, toAddress(plot.farmer), ZERO_BI, ZERO_BI, ZERO_BI, ZERO_BI, deltaHarvestablePods, ZERO_BI, block);
  }
}

// Increment number of unique sowers (protocol only)
function incrementSowers(protocol: Address, block: ethereum.Block): void {
  let field = loadField(protocol);
  field.numberOfSowers += 1;
  takeFieldSnapshots(field, block);
  field.save();
}

// Increment total number of sows for either an account or the protocol
function incrementSows(protocol: Address, account: Address, block: ethereum.Block, recurs: boolean = true): void {
  if (recurs && account != protocol) {
    incrementSows(protocol, protocol, block);
  }

  let field = loadField(account);
  field.numberOfSows += 1;
  takeFieldSnapshots(field, block);
  field.save();

  // Add to protocol numberOfSowers if this is the first time this account has sown
  if (account != protocol && field.numberOfSows == 0) {
    incrementSowers(protocol, block);
  }
}
