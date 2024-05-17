import { BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { assert } from "matchstick-as/assembly/index";
import {
  handlePodListingCancelled,
  handlePodListingCreated,
  handlePodListingCreated_v1_1,
  handlePodListingCreated_v2,
  handlePodListingFilled,
  handlePodListingFilled_v2,
  handlePodOrderCancelled,
  handlePodOrderCreated,
  handlePodOrderCreated_v2,
  handlePodOrderFilled,
  handlePodOrderFilled_v2
} from "../../src/MarketplaceHandler";
import {
  createPodListingCancelledEvent,
  createPodListingCreatedEvent,
  createPodListingCreatedEvent_v1_1,
  createPodListingCreatedEvent_v2,
  createPodListingFilledEvent,
  createPodListingFilledEvent_v2,
  createPodOrderCancelledEvent,
  createPodOrderCreatedEvent,
  createPodOrderCreatedEvent_v2,
  createPodOrderFilledEvent,
  createPodOrderFilledEvent_v2
} from "../event-mocking/Marketplace";
import { BI_10, ONE_BI, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import {
  PodListingCreated as PodListingCreated_v2,
  PodListingFilled as PodListingFilled_v2,
  PodOrderCreated as PodOrderCreated_v2,
  PodOrderFilled as PodOrderFilled_v2
} from "../../generated/BIP29-PodMarketplace/Beanstalk";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { transferPlot } from "./Field";
import {
  PodOrderCancelled,
  PodListingCancelled,
  PodListingCreated as PodListingCreated_v1,
  PodListingFilled as PodListingFilled_v1,
  PodOrderCreated as PodOrderCreated_v1,
  PodOrderFilled as PodOrderFilled_v1
} from "../../generated/Field/Beanstalk";
import { PodListingCreated as PodListingCreated_v1_1 } from "../../generated/Marketplace-Replanted/Beanstalk";

const pricingFunction = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000012c000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001010101010101010101010101010000"
);

export function getPodFillId(index: BigInt, event: ethereum.Event): string {
  return BEANSTALK.toHexString() + "-" + index.toString() + "-" + event.transaction.hash.toHexString();
}

export function fillListing_v1(
  from: string,
  to: string,
  listingIndex: BigInt,
  listingStart: BigInt,
  podAmount: BigInt,
  pricePerPod: BigInt
): PodListingFilled_v1 {
  // Perform plot transfer
  transferPlot(from, to, listingIndex.plus(listingStart), podAmount);

  const event = createPodListingFilledEvent(from, to, listingIndex, listingStart, podAmount);
  handlePodListingFilled(event);

  // Assert PodFill
  const podFillId = getPodFillId(event.params.index, event);
  assert.fieldEquals("PodFill", podFillId, "listing", event.params.from.toHexString() + "-" + event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "from", event.params.from.toHexString());
  assert.fieldEquals("PodFill", podFillId, "to", event.params.to.toHexString());
  assert.fieldEquals("PodFill", podFillId, "amount", event.params.amount.toString());
  assert.fieldEquals("PodFill", podFillId, "index", event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "start", event.params.start.toString());
  assert.fieldEquals("PodFill", podFillId, "costInBeans", podAmount.times(pricePerPod).div(BI_10.pow(6)).toString());

  return event;
}

export function fillListing_v2(
  from: string,
  to: string,
  listingIndex: BigInt,
  listingStart: BigInt,
  podAmount: BigInt,
  costInBeans: BigInt
): PodListingFilled_v2 {
  const event = createPodListingFilledEvent_v2(from, to, listingIndex, listingStart, podAmount, costInBeans);
  handlePodListingFilled_v2(event);

  // Perform plot transfer
  transferPlot(from, to, listingIndex.plus(listingStart), podAmount);

  // Assert PodFill
  const podFillId = getPodFillId(event.params.index, event);
  assert.fieldEquals("PodFill", podFillId, "listing", event.params.from.toHexString() + "-" + event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "from", event.params.from.toHexString());
  assert.fieldEquals("PodFill", podFillId, "to", event.params.to.toHexString());
  assert.fieldEquals("PodFill", podFillId, "amount", event.params.amount.toString());
  assert.fieldEquals("PodFill", podFillId, "index", event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "start", event.params.start.toString());
  assert.fieldEquals("PodFill", podFillId, "costInBeans", event.params.costInBeans.toString());

  return event;
}

export function fillOrder_v1(
  from: string,
  to: string,
  orderId: Bytes,
  index: BigInt,
  start: BigInt,
  podAmount: BigInt,
  pricePerPod: BigInt
): PodOrderFilled_v1 {
  const event = createPodOrderFilledEvent(from, to, orderId, index, start, podAmount);
  handlePodOrderFilled(event);

  // Perform plot transfer
  transferPlot(from, to, index.plus(start), podAmount);

  // Assert PodFill
  const podFillId = getPodFillId(index, event);
  assert.fieldEquals("PodFill", podFillId, "order", event.params.id.toHexString());
  assert.fieldEquals("PodFill", podFillId, "from", event.params.from.toHexString());
  assert.fieldEquals("PodFill", podFillId, "to", event.params.to.toHexString());
  assert.fieldEquals("PodFill", podFillId, "amount", event.params.amount.toString());
  assert.fieldEquals("PodFill", podFillId, "index", event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "start", event.params.start.toString());
  assert.fieldEquals("PodFill", podFillId, "costInBeans", podAmount.times(pricePerPod).div(BI_10.pow(6)).toString());

  return event;
}

export function fillOrder_v2(
  from: string,
  to: string,
  orderId: Bytes,
  index: BigInt,
  start: BigInt,
  podAmount: BigInt,
  costInBeans: BigInt
): PodOrderFilled_v2 {
  const event = createPodOrderFilledEvent_v2(from, to, orderId, index, start, podAmount, costInBeans);
  handlePodOrderFilled_v2(event);

  // Perform plot transfer
  transferPlot(from, to, index.plus(start), podAmount);

  // Assert PodFill
  const podFillId = getPodFillId(index, event);
  assert.fieldEquals("PodFill", podFillId, "order", event.params.id.toHexString());
  assert.fieldEquals("PodFill", podFillId, "from", event.params.from.toHexString());
  assert.fieldEquals("PodFill", podFillId, "to", event.params.to.toHexString());
  assert.fieldEquals("PodFill", podFillId, "amount", event.params.amount.toString());
  assert.fieldEquals("PodFill", podFillId, "index", event.params.index.toString());
  assert.fieldEquals("PodFill", podFillId, "start", event.params.start.toString());
  assert.fieldEquals("PodFill", podFillId, "costInBeans", event.params.costInBeans.toString());

  return event;
}

export function cancelListing(account: string, listingIndex: BigInt): PodListingCancelled {
  const event = createPodListingCancelledEvent(account, listingIndex);
  handlePodListingCancelled(event);
  return event;
}

export function cancelOrder(account: string, orderId: Bytes): PodOrderCancelled {
  const event = createPodOrderCancelledEvent(account, orderId);
  handlePodOrderCancelled(event);
  return event;
}

function assertListingCreated_v1(event: PodListingCreated_v1): void {
  let listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
  assert.fieldEquals("PodListing", listingID, "plot", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "farmer", event.params.account.toHexString());
  assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
  assert.fieldEquals("PodListing", listingID, "originalIndex", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "originalAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "index", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "start", event.params.start.toString());
  assert.fieldEquals("PodListing", listingID, "amount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "remainingAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodListing", listingID, "maxHarvestableIndex", event.params.maxHarvestableIndex.toString());
  assert.fieldEquals("PodListing", listingID, "mode", event.params.toWallet ? "0" : "1");
}

function assertListingCreated_v1_1(event: PodListingCreated_v1_1): void {
  let listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
  assert.fieldEquals("PodListing", listingID, "plot", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "farmer", event.params.account.toHexString());
  assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
  assert.fieldEquals("PodListing", listingID, "originalIndex", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "originalAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "index", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "start", event.params.start.toString());
  assert.fieldEquals("PodListing", listingID, "amount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "remainingAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodListing", listingID, "maxHarvestableIndex", event.params.maxHarvestableIndex.toString());
  assert.fieldEquals("PodListing", listingID, "mode", event.params.mode.toString());
}

function assertListingCreated_v2(event: PodListingCreated_v2): void {
  let listingID = event.params.account.toHexString() + "-" + event.params.index.toString();
  assert.fieldEquals("PodListing", listingID, "plot", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "farmer", event.params.account.toHexString());
  assert.fieldEquals("PodListing", listingID, "status", "ACTIVE");
  assert.fieldEquals("PodListing", listingID, "originalIndex", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "originalAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "index", event.params.index.toString());
  assert.fieldEquals("PodListing", listingID, "start", event.params.start.toString());
  assert.fieldEquals("PodListing", listingID, "amount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "remainingAmount", event.params.amount.toString());
  assert.fieldEquals("PodListing", listingID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodListing", listingID, "maxHarvestableIndex", event.params.maxHarvestableIndex.toString());
  assert.fieldEquals("PodListing", listingID, "minFillAmount", event.params.minFillAmount.toString());
  assert.fieldEquals("PodListing", listingID, "pricingFunction", event.params.pricingFunction.toHexString());
  assert.fieldEquals("PodListing", listingID, "mode", event.params.mode.toString());
  assert.fieldEquals("PodListing", listingID, "pricingType", event.params.pricingType.toString());
}

function assertOrderCreated_v1(account: string, event: PodOrderCreated_v1): void {
  let orderID = event.params.id.toHexString();
  assert.fieldEquals("PodOrder", orderID, "historyID", orderID + "-" + event.block.timestamp.toString());
  assert.fieldEquals("PodOrder", orderID, "farmer", account);
  assert.fieldEquals("PodOrder", orderID, "status", "ACTIVE");
  assert.fieldEquals(
    "PodOrder",
    orderID,
    "beanAmount",
    event.params.amount.times(BigInt.fromU32(event.params.pricePerPod)).div(BI_10.pow(6)).toString()
  );
  assert.fieldEquals("PodOrder", orderID, "beanAmountFilled", "0");
  assert.fieldEquals("PodOrder", orderID, "maxPlaceInLine", event.params.maxPlaceInLine.toString());
  assert.fieldEquals("PodOrder", orderID, "pricePerPod", event.params.pricePerPod.toString());
}

function assertOrderCreated_v2(account: string, event: PodOrderCreated_v2): void {
  let orderID = event.params.id.toHexString();
  assert.fieldEquals("PodOrder", orderID, "historyID", orderID + "-" + event.block.timestamp.toString());
  assert.fieldEquals("PodOrder", orderID, "farmer", account);
  assert.fieldEquals("PodOrder", orderID, "status", "ACTIVE");
  assert.fieldEquals("PodOrder", orderID, "beanAmount", event.params.amount.toString());
  assert.fieldEquals("PodOrder", orderID, "beanAmountFilled", "0");
  assert.fieldEquals("PodOrder", orderID, "minFillAmount", event.params.minFillAmount.toString());
  assert.fieldEquals("PodOrder", orderID, "maxPlaceInLine", event.params.maxPlaceInLine.toString());
  assert.fieldEquals("PodOrder", orderID, "pricePerPod", event.params.pricePerPod.toString());
  assert.fieldEquals("PodOrder", orderID, "pricingFunction", event.params.pricingFunction.toHexString());
  assert.fieldEquals("PodOrder", orderID, "pricingType", event.params.priceType.toString());
}

export function createListing_v1(
  account: string,
  index: BigInt,
  listedPods: BigInt,
  start: BigInt,
  pricePerPod: BigInt,
  maxHarvestableIndex: BigInt
): PodListingCreated_v1 {
  const event = createPodListingCreatedEvent(account, index, start, listedPods, pricePerPod, maxHarvestableIndex, true);
  handlePodListingCreated(event);
  assertListingCreated_v1(event);
  return event;
}

export function createListing_v1_1(
  account: string,
  index: BigInt,
  listedPods: BigInt,
  start: BigInt,
  pricePerPod: BigInt,
  maxHarvestableIndex: BigInt
): PodListingCreated_v1_1 {
  const event = createPodListingCreatedEvent_v1_1(account, index, start, listedPods, pricePerPod, maxHarvestableIndex, ZERO_BI);
  handlePodListingCreated_v1_1(event);
  assertListingCreated_v1_1(event);
  return event;
}

export function createListing_v2(
  account: string,
  index: BigInt,
  listedPods: BigInt,
  start: BigInt,
  maxHarvestableIndex: BigInt
): PodListingCreated_v2 {
  const event = createPodListingCreatedEvent_v2(
    account,
    index,
    start,
    listedPods,
    BigInt.fromString("250000"),
    maxHarvestableIndex,
    BigInt.fromString("10000000"),
    pricingFunction,
    BigInt.fromI32(0),
    BigInt.fromI32(1)
  );
  handlePodListingCreated_v2(event);
  assertListingCreated_v2(event);
  return event;
}

export function createOrder_v1(account: string, id: Bytes, beans: BigInt, pricePerPod: BigInt, maxPlaceInLine: BigInt): PodOrderCreated_v1 {
  const event = createPodOrderCreatedEvent(account, id, beans.times(BI_10.pow(6)).div(pricePerPod), pricePerPod, maxPlaceInLine);
  handlePodOrderCreated(event);
  assertOrderCreated_v1(account, event);
  return event;
}

export function createOrder_v2(account: string, id: Bytes, beans: BigInt, pricePerPod: BigInt, maxPlaceInLine: BigInt): PodOrderCreated_v2 {
  const event = createPodOrderCreatedEvent_v2(account, id, beans, pricePerPod, maxPlaceInLine, ONE_BI, pricingFunction, ZERO_BI);
  handlePodOrderCreated_v2(event);
  assertOrderCreated_v2(account, event);
  return event;
}

export function assertMarketListingsState(
  address: string,
  listings: string[],
  listedPods: BigInt,
  availableListedPods: BigInt,
  cancelledListedPods: BigInt,
  expiredListedPods: BigInt,
  filledListedPods: BigInt,
  podVolume: BigInt,
  beanVolume: BigInt
): void {
  assert.fieldEquals("PodMarketplace", address, "activeListings", arrayToString(listings));
  assert.fieldEquals("PodMarketplace", address, "listedPods", listedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "availableListedPods", availableListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "cancelledListedPods", cancelledListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "expiredListedPods", expiredListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "filledListedPods", filledListedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "podVolume", podVolume.toString());
  assert.fieldEquals("PodMarketplace", address, "beanVolume", beanVolume.toString());
}

export function assertMarketOrdersState(
  address: string,
  orders: string[],
  orderBeans: BigInt,
  availableOrderBeans: BigInt,
  filledOrderBeans: BigInt,
  filledOrderedPods: BigInt,
  cancelledOrderBeans: BigInt,
  podVolume: BigInt,
  beanVolume: BigInt
): void {
  assert.fieldEquals("PodMarketplace", address, "activeOrders", arrayToString(orders));
  assert.fieldEquals("PodMarketplace", address, "orderBeans", orderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "availableOrderBeans", availableOrderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "filledOrderBeans", filledOrderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "filledOrderedPods", filledOrderedPods.toString());
  assert.fieldEquals("PodMarketplace", address, "cancelledOrderBeans", cancelledOrderBeans.toString());
  assert.fieldEquals("PodMarketplace", address, "podVolume", podVolume.toString());
  assert.fieldEquals("PodMarketplace", address, "beanVolume", beanVolume.toString());
}

function arrayToString(a: string[]): string {
  return "[" + a.join(", ") + "]";
}
