import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { PodMarketplace, PodMarketplaceHourlySnapshot, PodMarketplaceDailySnapshot } from "../../generated/schema";
import { dayFromTimestamp } from "./Dates";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "./Field";
import { expirePodListingIfExists } from "./PodListing";

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

export function loadPodMarketplaceHourlySnapshot(diamondAddress: Address, season: i32, timestamp: BigInt): PodMarketplaceHourlySnapshot {
  // Hourly for Beanstalk is assumed to be by season. To keep other data correctly divided
  // by season, we elect to use the season number for the hour number.
  let id = diamondAddress.toHexString() + "-" + season.toString();
  let marketplace = loadPodMarketplace(diamondAddress);
  let snapshot = PodMarketplaceHourlySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new PodMarketplaceHourlySnapshot(id);
    snapshot.season = marketplace.season;
    snapshot.podMarketplace = diamondAddress.toHexString();
    snapshot.deltaListedPods = ZERO_BI;
    snapshot.listedPods = marketplace.listedPods;
    snapshot.deltaAvailableListedPods = ZERO_BI;
    snapshot.availableListedPods = marketplace.availableListedPods;
    snapshot.deltaFilledListedPods = ZERO_BI;
    snapshot.filledListedPods = marketplace.filledListedPods;
    snapshot.deltaExpiredListedPods = ZERO_BI;
    snapshot.expiredListedPods = marketplace.expiredListedPods;
    snapshot.deltaCancelledListedPods = ZERO_BI;
    snapshot.cancelledListedPods = marketplace.cancelledListedPods;
    snapshot.deltaOrderBeans = ZERO_BI;
    snapshot.orderBeans = marketplace.orderBeans;
    snapshot.deltaAvailableOrderBeans = ZERO_BI;
    snapshot.availableOrderBeans = marketplace.availableOrderBeans;
    snapshot.deltaFilledOrderedPods = ZERO_BI;
    snapshot.filledOrderedPods = marketplace.filledOrderedPods;
    snapshot.deltaFilledOrderBeans = ZERO_BI;
    snapshot.filledOrderBeans = marketplace.filledOrderBeans;
    snapshot.deltaCancelledOrderBeans = ZERO_BI;
    snapshot.cancelledOrderBeans = marketplace.cancelledOrderBeans;
    snapshot.deltaPodVolume = ZERO_BI;
    snapshot.podVolume = marketplace.podVolume;
    snapshot.deltaBeanVolume = ZERO_BI;
    snapshot.beanVolume = marketplace.beanVolume;
    snapshot.createdAt = timestamp;
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot;
}

export function loadPodMarketplaceDailySnapshot(diamondAddress: Address, timestamp: BigInt): PodMarketplaceDailySnapshot {
  let day = dayFromTimestamp(timestamp);
  let id = diamondAddress.toHexString() + "-" + day.toString();
  let marketplace = loadPodMarketplace(diamondAddress);
  let snapshot = PodMarketplaceDailySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new PodMarketplaceDailySnapshot(id);
    snapshot.season = marketplace.season;
    snapshot.podMarketplace = diamondAddress.toHexString();
    snapshot.deltaListedPods = ZERO_BI;
    snapshot.listedPods = marketplace.listedPods;
    snapshot.deltaAvailableListedPods = ZERO_BI;
    snapshot.availableListedPods = marketplace.availableListedPods;
    snapshot.deltaFilledListedPods = ZERO_BI;
    snapshot.filledListedPods = marketplace.filledListedPods;
    snapshot.deltaExpiredListedPods = ZERO_BI;
    snapshot.expiredListedPods = marketplace.expiredListedPods;
    snapshot.deltaCancelledListedPods = ZERO_BI;
    snapshot.cancelledListedPods = marketplace.cancelledListedPods;
    snapshot.deltaOrderBeans = ZERO_BI;
    snapshot.orderBeans = marketplace.orderBeans;
    snapshot.deltaAvailableOrderBeans = ZERO_BI;
    snapshot.availableOrderBeans = marketplace.availableOrderBeans;
    snapshot.deltaFilledOrderedPods = ZERO_BI;
    snapshot.filledOrderedPods = marketplace.filledOrderedPods;
    snapshot.deltaFilledOrderBeans = ZERO_BI;
    snapshot.filledOrderBeans = marketplace.filledOrderBeans;
    snapshot.deltaCancelledOrderBeans = ZERO_BI;
    snapshot.cancelledOrderBeans = marketplace.cancelledOrderBeans;
    snapshot.deltaPodVolume = ZERO_BI;
    snapshot.podVolume = marketplace.podVolume;
    snapshot.deltaBeanVolume = ZERO_BI;
    snapshot.beanVolume = marketplace.beanVolume;
    snapshot.createdAt = timestamp;
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot;
}

export function updateMarketListingBalances(
  marketAddress: Address,
  newPodAmount: BigInt,
  cancelledPodAmount: BigInt,
  filledPodAmount: BigInt,
  filledBeanAmount: BigInt,
  timestamp: BigInt
): void {
  let market = loadPodMarketplace(marketAddress);
  let marketHourly = loadPodMarketplaceHourlySnapshot(marketAddress, market.season, timestamp);
  let marketDaily = loadPodMarketplaceDailySnapshot(marketAddress, timestamp);

  const netListingChange = newPodAmount.minus(cancelledPodAmount).minus(filledPodAmount);

  market.listedPods = market.listedPods.plus(newPodAmount);
  market.availableListedPods = market.availableListedPods.plus(netListingChange);
  market.cancelledListedPods = market.cancelledListedPods.plus(cancelledPodAmount);
  market.filledListedPods = market.filledListedPods.plus(filledPodAmount);
  market.podVolume = market.podVolume.plus(filledPodAmount);
  market.beanVolume = market.beanVolume.plus(filledBeanAmount);
  market.save();

  marketHourly.season = market.season;
  marketHourly.deltaListedPods = marketHourly.deltaListedPods.plus(newPodAmount);
  marketHourly.listedPods = market.listedPods;
  marketHourly.deltaAvailableListedPods = marketHourly.deltaAvailableListedPods.plus(netListingChange);
  marketHourly.availableListedPods = market.availableListedPods;
  marketHourly.deltaCancelledListedPods = marketHourly.deltaCancelledListedPods.plus(cancelledPodAmount);
  marketHourly.cancelledListedPods = market.cancelledListedPods;
  marketHourly.deltaFilledListedPods = marketHourly.deltaFilledListedPods.plus(filledPodAmount);
  marketHourly.filledListedPods = market.filledListedPods;
  marketHourly.deltaPodVolume = marketHourly.deltaPodVolume.plus(filledPodAmount);
  marketHourly.podVolume = market.podVolume;
  marketHourly.deltaBeanVolume = marketHourly.deltaBeanVolume.plus(filledBeanAmount);
  marketHourly.beanVolume = market.beanVolume;
  marketHourly.updatedAt = timestamp;
  marketHourly.save();

  marketDaily.season = market.season;
  marketDaily.deltaListedPods = marketDaily.deltaListedPods.plus(newPodAmount);
  marketDaily.listedPods = market.listedPods;
  marketDaily.deltaAvailableListedPods = marketDaily.deltaAvailableListedPods.plus(netListingChange);
  marketDaily.availableListedPods = market.availableListedPods;
  marketDaily.deltaCancelledListedPods = marketDaily.deltaCancelledListedPods.plus(cancelledPodAmount);
  marketDaily.cancelledListedPods = market.cancelledListedPods;
  marketDaily.deltaFilledListedPods = marketDaily.deltaFilledListedPods.plus(filledPodAmount);
  marketDaily.filledListedPods = market.filledListedPods;
  marketDaily.deltaPodVolume = marketDaily.deltaPodVolume.plus(filledPodAmount);
  marketDaily.podVolume = market.podVolume;
  marketDaily.deltaBeanVolume = marketDaily.deltaBeanVolume.plus(filledBeanAmount);
  marketDaily.beanVolume = market.beanVolume;
  marketDaily.updatedAt = timestamp;
  marketDaily.save();
}

export function updateMarketOrderBalances(
  marketAddress: Address,
  newBeanAmount: BigInt,
  cancelledBeanAmount: BigInt,
  filledPodAmount: BigInt,
  filledBeanAmount: BigInt,
  timestamp: BigInt
): void {
  let market = loadPodMarketplace(marketAddress);
  let marketHourly = loadPodMarketplaceHourlySnapshot(marketAddress, market.season, timestamp);
  let marketDaily = loadPodMarketplaceDailySnapshot(marketAddress, timestamp);

  const netOrderChange = newBeanAmount.minus(cancelledBeanAmount).minus(filledBeanAmount);

  market.orderBeans = market.orderBeans.plus(newBeanAmount);
  market.availableOrderBeans = market.availableOrderBeans.plus(netOrderChange);
  market.filledOrderedPods = market.filledOrderedPods.plus(filledPodAmount);
  market.filledOrderBeans = market.filledOrderBeans.plus(filledBeanAmount);
  market.podVolume = market.podVolume.plus(filledPodAmount);
  market.beanVolume = market.beanVolume.plus(filledBeanAmount);
  market.cancelledOrderBeans = market.cancelledOrderBeans.plus(cancelledBeanAmount);
  market.save();

  marketHourly.deltaOrderBeans = marketHourly.deltaOrderBeans.plus(newBeanAmount);
  marketHourly.orderBeans = market.orderBeans;
  marketHourly.deltaAvailableOrderBeans = marketHourly.deltaAvailableOrderBeans.plus(netOrderChange);
  marketHourly.availableOrderBeans = market.availableOrderBeans;
  marketHourly.deltaFilledOrderedPods = marketHourly.deltaFilledOrderedPods.plus(filledPodAmount);
  marketHourly.filledOrderedPods = market.filledOrderedPods;
  marketHourly.deltaFilledOrderBeans = marketHourly.deltaFilledOrderBeans.plus(filledBeanAmount);
  marketHourly.filledOrderBeans = market.filledOrderBeans;
  marketHourly.deltaPodVolume = marketHourly.deltaPodVolume.plus(filledPodAmount);
  marketHourly.podVolume = market.podVolume;
  marketHourly.deltaBeanVolume = marketHourly.deltaBeanVolume.plus(filledBeanAmount);
  marketHourly.beanVolume = market.beanVolume;
  marketHourly.deltaCancelledOrderBeans = marketHourly.deltaCancelledOrderBeans.plus(cancelledBeanAmount);
  marketHourly.cancelledOrderBeans = market.cancelledOrderBeans;
  marketHourly.updatedAt = timestamp;
  marketHourly.save();

  marketDaily.deltaOrderBeans = marketDaily.deltaOrderBeans.plus(newBeanAmount);
  marketDaily.orderBeans = market.orderBeans;
  marketDaily.deltaAvailableOrderBeans = marketHourly.deltaAvailableOrderBeans.plus(netOrderChange);
  marketDaily.availableOrderBeans = market.availableOrderBeans;
  marketDaily.deltaFilledOrderedPods = marketDaily.deltaFilledOrderedPods.plus(filledPodAmount);
  marketDaily.filledOrderedPods = market.filledOrderedPods;
  marketDaily.deltaFilledOrderBeans = marketHourly.deltaFilledOrderBeans.plus(filledBeanAmount);
  marketDaily.filledOrderBeans = market.filledOrderBeans;
  marketDaily.deltaPodVolume = marketDaily.deltaPodVolume.plus(filledPodAmount);
  marketDaily.podVolume = market.podVolume;
  marketDaily.deltaBeanVolume = marketDaily.deltaBeanVolume.plus(filledBeanAmount);
  marketDaily.beanVolume = market.beanVolume;
  marketDaily.deltaCancelledOrderBeans = marketDaily.deltaCancelledOrderBeans.plus(cancelledBeanAmount);
  marketDaily.cancelledOrderBeans = market.cancelledOrderBeans;
  marketDaily.updatedAt = timestamp;
  marketDaily.save();
}

export function updateExpiredPlots(harvestableIndex: BigInt, diamondAddress: Address, timestamp: BigInt): void {
  let market = loadPodMarketplace(diamondAddress);
  let remainingListings = market.activeListings;

  // Cancel any pod marketplace listings beyond the index
  for (let i = 0; i < remainingListings.length; i++) {
    const destructured = remainingListings[i].split("-");
    const maxHarvestableIndex = BigInt.fromString(destructured[2]);
    if (harvestableIndex > maxHarvestableIndex) {
      // This method updates the marketplace entity, so it will perform the splice.
      expirePodListingIfExists(diamondAddress, destructured[0], BigInt.fromString(destructured[1]), timestamp, i);
      // A similar splice is done here also to track the updated index on the underlying array.
      remainingListings.splice(i--, 1);
    }
  }
}

export function updateActiveListings(
  diamondAddress: Address,
  action: MarketplaceAction,
  farmer: string,
  plotIndex: BigInt,
  expiryIndex: BigInt
): void {
  let market = loadPodMarketplace(diamondAddress);
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
