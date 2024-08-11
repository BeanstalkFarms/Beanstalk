import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  PodListingCreated,
  PodListingFilled,
  PodOrderCreated,
  PodOrderFilled,
  PodListingCancelled,
  PodOrderCancelled
} from "../../generated/Beanstalk-ABIs/SeedGauge";
import {
  PodListingCancelled as PodListingCancelledEvent,
  PodOrderCancelled as PodOrderCancelledEvent,
  PodOrder,
  PodListing
} from "../../generated/schema";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import {
  MarketplaceAction,
  podListingCreated,
  podListingFilled,
  podOrderCreated,
  podOrderFilled,
  updateActiveListings,
  updateActiveOrders,
  updateMarketListingBalances,
  updateMarketOrderBalances
} from "../utils/Marketplace";
import { getHarvestableIndex } from "../entities/Beanstalk";

export function handlePodListingCreated(event: PodListingCreated): void {
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

export function handlePodListingFilled(event: PodListingFilled): void {
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

export function handlePodOrderCreated(event: PodOrderCreated): void {
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

export function handlePodOrderFilled(event: PodOrderFilled): void {
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
    updateMarketListingBalances(event.address, event.address, ZERO_BI, listing.remainingAmount, ZERO_BI, ZERO_BI, event.block.timestamp);

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

export function handlePodOrderCancelled(event: PodOrderCancelled): void {
  let order = PodOrder.load(event.params.id.toHexString());
  if (order !== null && order.status == "ACTIVE") {
    order.status = order.podAmountFilled == ZERO_BI ? "CANCELLED" : "CANCELLED_PARTIAL";
    order.updatedAt = event.block.timestamp;
    order.save();

    updateActiveOrders(event.address, MarketplaceAction.CANCELLED, order.id, order.maxPlaceInLine);
    updateMarketOrderBalances(
      event.address,
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
