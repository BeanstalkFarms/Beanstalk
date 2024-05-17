import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  PodListingCancelled,
  PodListingCreated as PodListingCreated_v1,
  PodListingFilled as PodListingFilled_v1,
  PodOrderCancelled,
  PodOrderCreated as PodOrderCreated_v1,
  PodOrderFilled as PodOrderFilled_v1
} from "../generated/Field/Beanstalk";
import { PodListingCreated as PodListingCreated_v1_1 } from "../generated/Marketplace-Replanted/Beanstalk";
import {
  PodListingCreated as PodListingCreated_v2,
  PodListingFilled as PodListingFilled_v2,
  PodOrderCreated as PodOrderCreated_v2,
  PodOrderFilled as PodOrderFilled_v2
} from "../generated/BIP29-PodMarketplace/Beanstalk";

import {
  Plot,
  PodListingCreated as PodListingCreatedEvent,
  PodListingFilled as PodListingFilledEvent,
  PodListingCancelled as PodListingCancelledEvent,
  PodOrderCreated as PodOrderCreatedEvent,
  PodOrderFilled as PodOrderFilledEvent,
  PodOrderCancelled as PodOrderCancelledEvent,
  PodOrder,
  PodListing
} from "../generated/schema";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadFarmer } from "./utils/Farmer";
import { loadPodFill } from "./utils/PodFill";
import { createHistoricalPodListing, loadPodListing } from "./utils/PodListing";
import {
  MarketplaceAction,
  updateActiveListings,
  updateActiveOrders,
  updateMarketListingBalances,
  updateMarketOrderBalances
} from "./utils/PodMarketplace";
import { createHistoricalPodOrder, loadPodOrder } from "./utils/PodOrder";
import { getHarvestableIndex } from "./utils/Season";
import { loadPlot } from "./utils/Plot";

class PodListingCreatedParams {
  event: ethereum.Event;
  account: Address;
  index: BigInt;
  start: BigInt;
  amount: BigInt;
  pricePerPod: i32;
  maxHarvestableIndex: BigInt;
  mode: i32; // in v1, its called toWallet
  // v2
  minFillAmount: BigInt; // for v1, always 0
  pricingFunction: Bytes | null;
  pricingType: i32; // for v1, always 0
}

class PodOrderCreatedParams {
  event: ethereum.Event;
  account: Address;
  id: Bytes;
  beanAmount: BigInt;
  pricePerPod: i32;
  maxPlaceInLine: BigInt;
  // v2
  minFillAmount: BigInt; // for v1, always 0
  pricingFunction: Bytes | null;
  pricingType: i32; // for v1, always 0
}

// This one is the same for both listing/order fills.
class MarketFillParams {
  event: ethereum.Event;
  from: Address;
  to: Address;
  id: Bytes | null; // For pod order
  index: BigInt;
  start: BigInt;
  amount: BigInt;
  // v2; for v1, it can be computed and provided that way
  costInBeans: BigInt;
}

/* ------------------------------------
 * POD MARKETPLACE V1
 *
 * Proposal: BIP-11 https://bean.money/bip-11
 * Deployed: 02/05/2022 @ block 14148509
 * Code: https://github.com/BeanstalkFarms/Beanstalk/commit/75a67fc94cf2637ac1d7d7c89645492e31423fed
 * ------------------------------------
 */

export function handlePodListingCreated(event: PodListingCreated_v1): void {
  podListingCreated({
    event: event,
    account: event.params.account,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.toWallet ? 0 : 1,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handlePodListingCancelled(event: PodListingCancelled): void {
  let listing = PodListing.load(event.params.account.toHexString() + "-" + event.params.index.toString());
  if (listing !== null && listing.status == "ACTIVE") {
    updateActiveListings(
      event.address,
      MarketplaceAction.CANCELLED,
      event.params.account.toHexString(),
      listing.index,
      listing.maxHarvestableIndex
    );
    updateMarketListingBalances(event.address, ZERO_BI, listing.remainingAmount, ZERO_BI, ZERO_BI, event.block.timestamp);

    listing.status = listing.filled == ZERO_BI ? "CANCELLED" : "CANCELLED_PARTIAL";
    listing.updatedAt = event.block.timestamp;
    listing.save();

    // Save the raw event data
    let id = "podListingCancelled-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let rawEvent = new PodListingCancelledEvent(id);
    rawEvent.hash = event.transaction.hash.toHexString();
    rawEvent.logIndex = event.logIndex.toI32();
    rawEvent.protocol = event.address.toHexString();
    rawEvent.historyID = listing.historyID;
    rawEvent.account = event.params.account.toHexString();
    rawEvent.placeInLine = event.params.index.plus(listing.start).minus(getHarvestableIndex(event.address));
    rawEvent.index = event.params.index;
    rawEvent.blockNumber = event.block.number;
    rawEvent.createdAt = event.block.timestamp;
    rawEvent.save();
  }
}

export function handlePodListingFilled(event: PodListingFilled_v1): void {
  let listing = loadPodListing(event.params.from, event.params.index);
  const beanAmount = BigInt.fromI32(listing.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000));

  podListingFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: null,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: beanAmount
  });
}

export function handlePodOrderCreated(event: PodOrderCreated_v1): void {
  const beanAmount = event.params.amount.times(BigInt.fromI32(event.params.pricePerPod)).div(BigInt.fromString("1000000"));
  podOrderCreated({
    event: event,
    account: event.params.account,
    id: event.params.id,
    beanAmount: beanAmount,
    pricePerPod: event.params.pricePerPod,
    maxPlaceInLine: event.params.maxPlaceInLine,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handlePodOrderFilled(event: PodOrderFilled_v1): void {
  let order = loadPodOrder(event.params.id);
  let beanAmount = BigInt.fromI32(order.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000));

  podOrderFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: event.params.id,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: beanAmount
  });
}

export function handlePodOrderCancelled(event: PodOrderCancelled): void {
  let order = PodOrder.load(event.params.id.toHexString());
  if (order !== null && order.status == "ACTIVE") {
    order.status = order.podAmountFilled == ZERO_BI ? "CANCELLED" : "CANCELLED_PARTIAL";
    order.updatedAt = event.block.timestamp;
    order.save();

    updateActiveOrders(event.address, MarketplaceAction.CANCELLED, order.id, order.maxPlaceInLine);
    updateMarketOrderBalances(
      event.address,
      ZERO_BI,
      order.beanAmount.minus(order.beanAmountFilled),
      ZERO_BI,
      ZERO_BI,
      event.block.timestamp
    );

    // Save the raw event data
    let id = "podOrderCancelled-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let rawEvent = new PodOrderCancelledEvent(id);
    rawEvent.hash = event.transaction.hash.toHexString();
    rawEvent.logIndex = event.logIndex.toI32();
    rawEvent.protocol = event.address.toHexString();
    rawEvent.historyID = order.historyID;
    rawEvent.account = event.params.account.toHexString();
    rawEvent.orderId = event.params.id.toHexString();
    rawEvent.blockNumber = event.block.number;
    rawEvent.createdAt = event.block.timestamp;
    rawEvent.save();
  }
}

/* ------------------------------------
 * POD MARKETPLACE V1 - REPLANTED
 *
 * When Beanstalk was Replanted, `event.params.mode` was changed from
 * `bool` to `uint8`.
 *
 * Proposal: BIP-21
 * Deployed: 08/05/2022 at block 15278963
 * ------------------------------------
 */

export function handlePodListingCreated_v1_1(event: PodListingCreated_v1_1): void {
  podListingCreated({
    event: event,
    account: event.params.account,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.mode,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

/* ------------------------------------
 * POD MARKETPLACE V2
 *
 * Proposal: BIP-29 https://bean.money/bip-29
 * Deployed: 11/12/2022 @ block 15951072
 * ------------------------------------
 */

export function handlePodListingCreated_v2(event: PodListingCreated_v2): void {
  podListingCreated({
    event: event,
    account: event.params.account,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.mode,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: event.params.pricingFunction,
    pricingType: event.params.pricingType
  });
}

export function handlePodListingFilled_v2(event: PodListingFilled_v2): void {
  podListingFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: null,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: event.params.costInBeans
  });
}

export function handlePodOrderCreated_v2(event: PodOrderCreated_v2): void {
  podOrderCreated({
    event: event,
    account: event.params.account,
    id: event.params.id,
    beanAmount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxPlaceInLine: event.params.maxPlaceInLine,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: event.params.pricingFunction,
    pricingType: event.params.priceType
  });
}

export function handlePodOrderFilled_v2(event: PodOrderFilled_v2): void {
  podOrderFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: event.params.id,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: event.params.costInBeans
  });
}

/* ------------------------------------
 * SHARED FUNCTIONS
 * ------------------------------------
 */

function podListingCreated(params: PodListingCreatedParams): void {
  let plot = Plot.load(params.index.toString());
  if (plot == null) {
    return;
  }

  /// Upsert PodListing
  let listing = loadPodListing(params.account, params.index);
  if (listing.createdAt !== ZERO_BI) {
    // Re-listed prior plot with new info
    createHistoricalPodListing(listing);
    listing.fill = null;
    listing.filled = ZERO_BI;
    listing.filledAmount = ZERO_BI;
  }

  listing.historyID = listing.id + "-" + params.event.block.timestamp.toString();
  listing.plot = plot.id;

  listing.start = params.start;
  listing.mode = params.mode;

  listing.minFillAmount = params.minFillAmount;
  listing.maxHarvestableIndex = params.maxHarvestableIndex;

  listing.pricingType = params.pricingType;
  listing.pricePerPod = params.pricePerPod;
  listing.pricingFunction = params.pricingFunction;

  listing.originalIndex = params.index;
  listing.originalAmount = params.amount;

  listing.amount = params.amount;
  listing.remainingAmount = listing.originalAmount;

  listing.status = "ACTIVE";
  listing.createdAt = listing.createdAt == ZERO_BI ? params.event.block.timestamp : listing.createdAt;
  listing.updatedAt = params.event.block.timestamp;
  listing.creationHash = params.event.transaction.hash.toHexString();

  listing.save();

  /// Update plot
  plot.listing = listing.id;
  plot.save();

  /// Update market totals
  updateActiveListings(
    params.event.address,
    MarketplaceAction.CREATED,
    params.account.toHexString(),
    listing.index,
    listing.maxHarvestableIndex
  );
  updateMarketListingBalances(params.event.address, params.amount, ZERO_BI, ZERO_BI, ZERO_BI, params.event.block.timestamp);

  /// Save  raw event data
  let id = "podListingCreated-" + params.event.transaction.hash.toHexString() + "-" + params.event.logIndex.toString();
  let rawEvent = new PodListingCreatedEvent(id);
  rawEvent.hash = params.event.transaction.hash.toHexString();
  rawEvent.logIndex = params.event.logIndex.toI32();
  rawEvent.protocol = params.event.address.toHexString();
  rawEvent.historyID = listing.historyID;
  rawEvent.account = params.account.toHexString();
  rawEvent.placeInLine = params.index.plus(params.start).minus(getHarvestableIndex(params.event.address));
  rawEvent.index = params.index;
  rawEvent.start = params.start;
  rawEvent.amount = params.amount;
  rawEvent.pricePerPod = params.pricePerPod;
  rawEvent.maxHarvestableIndex = params.maxHarvestableIndex;
  rawEvent.minFillAmount = params.minFillAmount;
  rawEvent.mode = params.mode;
  rawEvent.pricingFunction = params.pricingFunction;
  rawEvent.pricingType = params.pricingType;
  rawEvent.blockNumber = params.event.block.number;
  rawEvent.createdAt = params.event.block.timestamp;
  rawEvent.save();
}

function podListingFilled(params: MarketFillParams): void {
  let listing = loadPodListing(params.from, params.index);

  updateMarketListingBalances(params.event.address, ZERO_BI, ZERO_BI, params.amount, params.costInBeans, params.event.block.timestamp);

  listing.filledAmount = params.amount;
  listing.remainingAmount = listing.remainingAmount.minus(params.amount);
  listing.filled = listing.filled.plus(params.amount);
  listing.updatedAt = params.event.block.timestamp;

  let originalHistoryID = listing.historyID;
  if (listing.remainingAmount == ZERO_BI) {
    listing.status = "FILLED";
    updateActiveListings(
      params.event.address,
      MarketplaceAction.FILLED_FULL,
      params.from.toHexString(),
      listing.index,
      listing.maxHarvestableIndex
    );
  } else {
    listing.status = "FILLED_PARTIAL";

    let remainingListing = loadPodListing(Address.fromString(listing.farmer), listing.index.plus(params.amount).plus(listing.start));
    remainingListing.historyID = remainingListing.id + "-" + params.event.block.timestamp.toString();
    remainingListing.plot = listing.index.plus(params.amount).plus(listing.start).toString();
    remainingListing.createdAt = listing.createdAt;
    remainingListing.updatedAt = params.event.block.timestamp;
    remainingListing.originalIndex = listing.originalIndex;
    remainingListing.start = ZERO_BI;
    remainingListing.amount = listing.remainingAmount;
    remainingListing.originalAmount = listing.originalAmount;
    remainingListing.filled = listing.filled;
    remainingListing.remainingAmount = listing.remainingAmount;
    remainingListing.pricePerPod = listing.pricePerPod;
    remainingListing.maxHarvestableIndex = listing.maxHarvestableIndex;
    remainingListing.mode = listing.mode;
    remainingListing.creationHash = params.event.transaction.hash.toHexString();
    remainingListing.minFillAmount = listing.minFillAmount;
    remainingListing.save();

    // Process the partial fill on the prev listing, and the new listing
    updateActiveListings(
      params.event.address,
      MarketplaceAction.FILLED_PARTIAL,
      params.from.toHexString(),
      listing.index,
      listing.maxHarvestableIndex
    );
    updateActiveListings(
      params.event.address,
      MarketplaceAction.CREATED,
      params.from.toHexString(),
      remainingListing.index,
      remainingListing.maxHarvestableIndex
    );
  }

  let fill = loadPodFill(params.event.address, params.index, params.event.transaction.hash.toHexString());
  fill.createdAt = params.event.block.timestamp;
  fill.listing = listing.id;
  fill.from = params.from.toHexString();
  fill.to = params.to.toHexString();
  fill.amount = params.amount;
  fill.placeInLine = params.index.plus(params.start).minus(getHarvestableIndex(params.event.address));
  fill.index = params.index;
  fill.start = params.start;
  fill.costInBeans = params.costInBeans;
  fill.save();

  listing.fill = fill.id;
  listing.save();

  setBeansPerPodAfterFill(params.event, fill.index, fill.start, fill.amount, fill.costInBeans);

  // Save the raw event data
  let id = "podListingFilled-" + params.event.transaction.hash.toHexString() + "-" + params.event.logIndex.toString();
  let rawEvent = new PodListingFilledEvent(id);
  rawEvent.hash = params.event.transaction.hash.toHexString();
  rawEvent.logIndex = params.event.logIndex.toI32();
  rawEvent.protocol = params.event.address.toHexString();
  rawEvent.historyID = originalHistoryID;
  rawEvent.from = params.from.toHexString();
  rawEvent.to = params.to.toHexString();
  rawEvent.placeInLine = fill.placeInLine;
  rawEvent.index = params.index;
  rawEvent.start = params.start;
  rawEvent.amount = params.amount;
  rawEvent.costInBeans = params.costInBeans;
  rawEvent.blockNumber = params.event.block.number;
  rawEvent.createdAt = params.event.block.timestamp;
  rawEvent.save();
}

function podOrderCreated(params: PodOrderCreatedParams): void {
  let order = loadPodOrder(params.id);
  loadFarmer(params.account);

  if (order.status != "") {
    createHistoricalPodOrder(order);
  }

  order.historyID = order.id + "-" + params.event.block.timestamp.toString();
  order.farmer = params.account.toHexString();
  order.createdAt = params.event.block.timestamp;
  order.updatedAt = params.event.block.timestamp;
  order.status = "ACTIVE";
  order.beanAmount = params.beanAmount;
  order.beanAmountFilled = ZERO_BI;
  order.podAmountFilled = ZERO_BI;
  order.minFillAmount = params.minFillAmount;
  order.maxPlaceInLine = params.maxPlaceInLine;
  order.pricePerPod = params.pricePerPod;
  order.pricingFunction = params.pricingFunction;
  order.pricingType = params.pricingType;
  order.creationHash = params.event.transaction.hash.toHexString();
  order.fills = [];
  order.save();

  updateActiveOrders(params.event.address, MarketplaceAction.CREATED, order.id, order.maxPlaceInLine);
  updateMarketOrderBalances(params.event.address, params.beanAmount, ZERO_BI, ZERO_BI, ZERO_BI, params.event.block.timestamp);

  // Save the raw event data
  let id = "podOrderCreated-" + params.event.transaction.hash.toHexString() + "-" + params.event.logIndex.toString();
  let rawEvent = new PodOrderCreatedEvent(id);
  rawEvent.hash = params.event.transaction.hash.toHexString();
  rawEvent.logIndex = params.event.logIndex.toI32();
  rawEvent.protocol = params.event.address.toHexString();
  rawEvent.historyID = order.historyID;
  rawEvent.account = params.account.toHexString();
  rawEvent.orderId = params.id.toHexString();
  rawEvent.amount = params.beanAmount;
  rawEvent.pricePerPod = params.pricePerPod;
  rawEvent.maxPlaceInLine = params.maxPlaceInLine;
  rawEvent.pricingFunction = params.pricingFunction;
  rawEvent.pricingType = params.pricingType;
  rawEvent.blockNumber = params.event.block.number;
  rawEvent.createdAt = params.event.block.timestamp;
  rawEvent.save();
}

function podOrderFilled(params: MarketFillParams): void {
  let order = loadPodOrder(params.id!);
  let fill = loadPodFill(params.event.address, params.index, params.event.transaction.hash.toHexString());

  order.updatedAt = params.event.block.timestamp;
  order.beanAmountFilled = order.beanAmountFilled.plus(params.costInBeans);
  order.podAmountFilled = order.podAmountFilled.plus(params.amount);
  order.status = order.beanAmount == order.beanAmountFilled ? "FILLED" : "ACTIVE";
  let newFills = order.fills;
  newFills.push(fill.id);
  order.fills = newFills;
  order.save();

  fill.createdAt = params.event.block.timestamp;
  fill.order = order.id;
  fill.from = params.from.toHexString();
  fill.to = params.to.toHexString();
  fill.amount = params.amount;
  fill.placeInLine = params.index.plus(params.start).minus(getHarvestableIndex(params.event.address));
  fill.index = params.index;
  fill.start = params.start;
  fill.costInBeans = params.costInBeans;
  fill.save();

  setBeansPerPodAfterFill(params.event, fill.index, fill.start, fill.amount, fill.costInBeans);

  if (order.status == "FILLED") {
    updateActiveOrders(params.event.address, MarketplaceAction.FILLED_FULL, order.id, order.maxPlaceInLine);
  }

  updateMarketOrderBalances(params.event.address, ZERO_BI, ZERO_BI, params.amount, params.costInBeans, params.event.block.timestamp);

  // Save the raw event data
  let id = "podOrderFilled-" + params.event.transaction.hash.toHexString() + "-" + params.event.logIndex.toString();
  let rawEvent = new PodOrderFilledEvent(id);
  rawEvent.hash = params.event.transaction.hash.toHexString();
  rawEvent.logIndex = params.event.logIndex.toI32();
  rawEvent.protocol = params.event.address.toHexString();
  rawEvent.historyID = order.historyID;
  rawEvent.from = params.from.toHexString();
  rawEvent.to = params.to.toHexString();
  rawEvent.placeInLine = params.index.plus(params.start).minus(getHarvestableIndex(params.event.address));
  rawEvent.index = params.index;
  rawEvent.start = params.start;
  rawEvent.amount = params.amount;
  rawEvent.costInBeans = params.costInBeans;
  rawEvent.blockNumber = params.event.block.number;
  rawEvent.createdAt = params.event.block.timestamp;
  rawEvent.save();
}

function setBeansPerPodAfterFill(event: ethereum.Event, plotIndex: BigInt, start: BigInt, length: BigInt, costInBeans: BigInt): void {
  // Load the plot that is being sent. It may or may not have been created already, depending
  // on whether the PlotTransfer event has already been processed (sometims its emitted after the market transfer).
  let fillPlot = loadPlot(event.address, plotIndex.plus(start));

  if (start == ZERO_BI && length < fillPlot.pods) {
    // When sending the start of a plot via market, these cannot be set in any subsequent transfer,
    // since the start plot has already been modified.
    let remainderPlot = loadPlot(event.address, plotIndex.plus(length));
    remainderPlot.sourceHash = fillPlot.sourceHash;
    remainderPlot.beansPerPod = fillPlot.beansPerPod;
    remainderPlot.source = fillPlot.source;
    remainderPlot.save();
  }

  // Update source/cost per pod of the sold plot
  fillPlot.beansPerPod = costInBeans.times(BI_10.pow(6)).div(length);
  fillPlot.source = "MARKET";
  fillPlot.sourceHash = event.transaction.hash.toHexString();
  fillPlot.save();
}
