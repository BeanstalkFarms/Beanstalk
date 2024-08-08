import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { PodMarketplace, PodFill } from "../../generated/schema";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "./Field";
import { expirePodListingIfExists } from "./PodListing";
import { takeMarketSnapshots } from "./snapshots/Marketplace";

export enum MarketplaceAction {
  CREATED,
  FILLED_PARTIAL,
  FILLED_FULL,
  CANCELLED,
  EXPIRED
}

export function loadPodMarketplace(diamondAddress: Address): PodMarketplace {
  let marketplace = PodMarketplace.load(diamondAddress.toHexString());
  if (marketplace == null) {
    let field = loadField(diamondAddress);
    marketplace = new PodMarketplace(diamondAddress.toHexString());
    marketplace.season = field.season;
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

export function loadPodFill(diamondAddress: Address, index: BigInt, hash: String): PodFill {
  let id = diamondAddress.toHexString() + "-" + index.toString() + "-" + hash;
  let fill = PodFill.load(id);
  if (fill == null) {
    fill = new PodFill(id);
    fill.podMarketplace = diamondAddress.toHexString();
    fill.createdAt = ZERO_BI;
    fill.fromFarmer = "";
    fill.toFarmer = "";
    fill.placeInLine = ZERO_BI;
    fill.amount = ZERO_BI;
    fill.index = ZERO_BI;
    fill.start = ZERO_BI;
    fill.costInBeans = ZERO_BI;
    fill.save();
  }
  return fill;
}

export function updateMarketListingBalances(
  protocol: Address,
  marketAddress: Address,
  newPodAmount: BigInt,
  cancelledPodAmount: BigInt,
  filledPodAmount: BigInt,
  filledBeanAmount: BigInt,
  timestamp: BigInt
): void {
  let market = loadPodMarketplace(marketAddress);

  const netListingChange = newPodAmount.minus(cancelledPodAmount).minus(filledPodAmount);

  market.listedPods = market.listedPods.plus(newPodAmount);
  market.availableListedPods = market.availableListedPods.plus(netListingChange);
  market.cancelledListedPods = market.cancelledListedPods.plus(cancelledPodAmount);
  market.filledListedPods = market.filledListedPods.plus(filledPodAmount);
  market.podVolume = market.podVolume.plus(filledPodAmount);
  market.beanVolume = market.beanVolume.plus(filledBeanAmount);

  takeMarketSnapshots(market, protocol, timestamp);
  market.save();
}

export function updateMarketOrderBalances(
  protocol: Address,
  marketAddress: Address,
  newBeanAmount: BigInt,
  cancelledBeanAmount: BigInt,
  filledPodAmount: BigInt,
  filledBeanAmount: BigInt,
  timestamp: BigInt
): void {
  let market = loadPodMarketplace(marketAddress);

  const netOrderChange = newBeanAmount.minus(cancelledBeanAmount).minus(filledBeanAmount);

  market.orderBeans = market.orderBeans.plus(newBeanAmount);
  market.availableOrderBeans = market.availableOrderBeans.plus(netOrderChange);
  market.filledOrderedPods = market.filledOrderedPods.plus(filledPodAmount);
  market.filledOrderBeans = market.filledOrderBeans.plus(filledBeanAmount);
  market.podVolume = market.podVolume.plus(filledPodAmount);
  market.beanVolume = market.beanVolume.plus(filledBeanAmount);
  market.cancelledOrderBeans = market.cancelledOrderBeans.plus(cancelledBeanAmount);

  takeMarketSnapshots(market, protocol, timestamp);
  market.save();
}

export function updateExpiredPlots(protocol: Address, harvestableIndex: BigInt, timestamp: BigInt): void {
  let market = loadPodMarketplace(protocol);
  let remainingListings = market.activeListings;

  // Cancel any pod marketplace listings beyond the index
  for (let i = 0; i < remainingListings.length; i++) {
    const destructured = remainingListings[i].split("-");
    const maxHarvestableIndex = BigInt.fromString(destructured[2]);
    if (harvestableIndex > maxHarvestableIndex) {
      // This method updates the marketplace entity, so it will perform the splice.
      expirePodListingIfExists(protocol, destructured[0], BigInt.fromString(destructured[1]), timestamp, i);
      // A similar splice is done here also to track the updated index on the underlying array.
      remainingListings.splice(i--, 1);
    }
  }
}

export function updateActiveListings(
  protocol: Address,
  action: MarketplaceAction,
  farmer: string,
  plotIndex: BigInt,
  expiryIndex: BigInt
): void {
  let market = loadPodMarketplace(protocol);
  let listings = market.activeListings;

  if (action == MarketplaceAction.CREATED) {
    listings.push(farmer + "-" + plotIndex.toString() + "-" + expiryIndex.toString());
  }
  if (
    [MarketplaceAction.CANCELLED, MarketplaceAction.FILLED_PARTIAL, MarketplaceAction.FILLED_FULL, MarketplaceAction.EXPIRED].includes(
      action
    )
  ) {
    listings.splice(Marketplace_findIndex_listing(listings, plotIndex), 1);
  }

  market.activeListings = listings;
  market.save();
}

export function updateActiveOrders(diamondAddress: Address, action: MarketplaceAction, orderId: string, maxPlaceInLine: BigInt): void {
  let market = loadPodMarketplace(diamondAddress);
  let orders = market.activeOrders;

  if (action == MarketplaceAction.CREATED) {
    orders.push(orderId + "-" + maxPlaceInLine.toString());
  }
  if ([MarketplaceAction.CANCELLED, MarketplaceAction.FILLED_FULL, MarketplaceAction.EXPIRED].includes(action)) {
    orders.splice(Marketplace_findIndex_order(orders, orderId), 1);
  }

  market.activeOrders = orders;
  market.save();
}

export function Marketplace_findIndex_listing(listings: string[], plotIndex: BigInt): i32 {
  for (let i = 0; i < listings.length; i++) {
    const values = listings[i].split("-");
    if (BigInt.fromString(values[1]) == plotIndex) {
      return i;
    }
  }
  return -1;
}

export function Marketplace_findIndex_order(orders: string[], orderId: string): i32 {
  for (let i = 0; i < orders.length; i++) {
    const values = orders[i].split("-");
    if (values[0] == orderId) {
      return i;
    }
  }
  return -1;
}
