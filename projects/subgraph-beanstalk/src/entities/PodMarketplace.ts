import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { PodFill, PodListing, PodMarketplace, PodOrder } from "../../generated/schema";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getCurrentSeason } from "./Beanstalk";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Bytes";

export function loadPodMarketplace(): PodMarketplace {
  let marketplace = PodMarketplace.load("0");
  if (marketplace == null) {
    marketplace = new PodMarketplace("0");
    marketplace.season = getCurrentSeason();
    marketplace.activeListings = [];
    marketplace.activeOrders = [];
    marketplace.listedPods = ZERO_BI;
    marketplace.availableListedPods = ZERO_BI;
    marketplace.filledListedPods = ZERO_BI;
    marketplace.expiredListedPods = ZERO_BI;
    marketplace.cancelledListedPods = ZERO_BI;
    marketplace.orderBeans = ZERO_BI;
    marketplace.availableOrderBeans = ZERO_BI;
    marketplace.filledOrderedPods = ZERO_BI;
    marketplace.filledOrderBeans = ZERO_BI;
    marketplace.cancelledOrderBeans = ZERO_BI;
    marketplace.podVolume = ZERO_BI;
    marketplace.beanVolume = ZERO_BI;
    marketplace.save();
  }
  return marketplace;
}

export function loadPodFill(protocol: Address, index: BigInt, hash: String): PodFill {
  let id = protocol.toHexString() + "-" + index.toString() + "-" + hash;
  let fill = PodFill.load(id);
  if (fill == null) {
    fill = new PodFill(id);
    fill.podMarketplace = "0";
    fill.createdAt = ZERO_BI;
    fill.fromFarmer = ADDRESS_ZERO;
    fill.toFarmer = ADDRESS_ZERO;
    fill.placeInLine = ZERO_BI;
    fill.amount = ZERO_BI;
    fill.index = ZERO_BI;
    fill.start = ZERO_BI;
    fill.costInBeans = ZERO_BI;
    fill.save();
  }
  return fill;
}

export function loadPodListing(account: Address, index: BigInt): PodListing {
  let id = account.toHexString() + "-" + index.toString();
  let listing = PodListing.load(id);
  if (listing == null) {
    listing = new PodListing(id);
    listing.podMarketplace = "0";
    listing.historyID = "";
    listing.plot = index.toString();
    listing.farmer = account;
    listing.index = index;
    listing.start = ZERO_BI;
    listing.mode = 0;
    listing.maxHarvestableIndex = ZERO_BI;
    listing.minFillAmount = ZERO_BI;
    listing.pricePerPod = 0;
    listing.originalIndex = index;
    listing.originalAmount = ZERO_BI;
    listing.filled = ZERO_BI;
    listing.amount = ZERO_BI;
    listing.remainingAmount = ZERO_BI;
    listing.filledAmount = ZERO_BI;
    listing.status = "ACTIVE";
    listing.createdAt = ZERO_BI;
    listing.creationHash = ADDRESS_ZERO;
    listing.updatedAt = ZERO_BI;
    listing.save();
  }
  return listing;
}

export function createHistoricalPodListing(listing: PodListing): void {
  let created = false;
  let id = listing.id;
  for (let i = 0; !created; i++) {
    id = listing.id + "-" + i.toString();
    let newListing = PodListing.load(id);
    if (newListing == null) {
      newListing = new PodListing(id);
      newListing.podMarketplace = listing.podMarketplace;
      newListing.historyID = listing.historyID;
      newListing.plot = listing.plot;
      newListing.farmer = listing.farmer;
      newListing.index = listing.index;
      newListing.start = listing.start;
      newListing.mode = listing.mode;
      newListing.maxHarvestableIndex = listing.maxHarvestableIndex;
      newListing.minFillAmount = listing.minFillAmount;
      newListing.pricePerPod = listing.pricePerPod;
      newListing.originalIndex = listing.originalIndex;
      newListing.originalAmount = listing.originalAmount;
      newListing.filled = listing.filled;
      newListing.amount = listing.amount;
      newListing.remainingAmount = listing.remainingAmount;
      newListing.filledAmount = listing.filledAmount;
      newListing.fill = listing.fill;
      newListing.status = listing.status;
      newListing.createdAt = listing.createdAt;
      newListing.updatedAt = listing.updatedAt;
      newListing.creationHash = listing.creationHash;
      newListing.save();
      created = true;
    }
  }
}

export function loadPodOrder(orderID: Bytes): PodOrder {
  let order = PodOrder.load(orderID.toHexString());
  if (order == null) {
    order = new PodOrder(orderID.toHexString());
    order.podMarketplace = "0";
    order.historyID = "";
    order.farmer = ADDRESS_ZERO;
    order.createdAt = ZERO_BI;
    order.updatedAt = ZERO_BI;
    order.status = "";
    order.beanAmount = ZERO_BI;
    order.podAmountFilled = ZERO_BI;
    order.beanAmountFilled = ZERO_BI;
    order.minFillAmount = ZERO_BI;
    order.maxPlaceInLine = ZERO_BI;
    order.pricePerPod = 0;
    order.creationHash = ADDRESS_ZERO;
    order.fills = [];
    order.save();
  }
  return order;
}

export function createHistoricalPodOrder(order: PodOrder): void {
  let created = false;
  let id = order.id;
  for (let i = 0; !created; i++) {
    id = order.id + "-" + i.toString();
    let newOrder = PodOrder.load(id);
    if (newOrder == null) {
      newOrder = new PodOrder(id);
      newOrder.podMarketplace = order.podMarketplace;
      newOrder.historyID = order.historyID;
      newOrder.farmer = order.farmer;
      newOrder.createdAt = order.createdAt;
      newOrder.updatedAt = order.updatedAt;
      newOrder.status = order.status;
      newOrder.beanAmount = order.beanAmount;
      newOrder.podAmountFilled = order.podAmountFilled;
      newOrder.beanAmountFilled = order.beanAmountFilled;
      newOrder.minFillAmount = order.minFillAmount;
      newOrder.maxPlaceInLine = order.maxPlaceInLine;
      newOrder.pricePerPod = order.pricePerPod;
      newOrder.creationHash = order.creationHash;
      newOrder.fills = order.fills;
      newOrder.save();
      created = true;
    }
  }
}
