import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { PodMarketplace, PodMarketplaceHourlySnapshot, PodMarketplaceDailySnapshot } from "../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "./Field";
import { expirePodListing, loadPodListing } from "./PodListing";

export function loadPodMarketplace(diamondAddress: Address): PodMarketplace {
  let marketplace = PodMarketplace.load(diamondAddress.toHexString());
  if (marketplace == null) {
    let field = loadField(diamondAddress);
    marketplace = new PodMarketplace(diamondAddress.toHexString());
    marketplace.season = field.season;
    marketplace.listingIndexes = [];
    marketplace.orders = [];
    marketplace.listedPods = ZERO_BI;
    marketplace.filledListedPods = ZERO_BI;
    marketplace.expiredListedPods = ZERO_BI;
    marketplace.cancelledListedPods = ZERO_BI;
    marketplace.availableListedPods = ZERO_BI;
    marketplace.orderBeans = ZERO_BI;
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
    snapshot.deltaFilledListedPods = ZERO_BI;
    snapshot.filledListedPods = marketplace.filledListedPods;
    snapshot.deltaExpiredListedPods = ZERO_BI;
    snapshot.expiredListedPods = marketplace.expiredListedPods;
    snapshot.deltaCancelledListedPods = ZERO_BI;
    snapshot.cancelledListedPods = marketplace.cancelledListedPods;
    snapshot.deltaAvailableListedPods = ZERO_BI;
    snapshot.availableListedPods = marketplace.availableListedPods;
    snapshot.deltaOrderBeans = ZERO_BI;
    snapshot.orderBeans = marketplace.orderBeans;
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
    snapshot.deltaFilledListedPods = ZERO_BI;
    snapshot.filledListedPods = marketplace.filledListedPods;
    snapshot.deltaExpiredListedPods = ZERO_BI;
    snapshot.expiredListedPods = marketplace.expiredListedPods;
    snapshot.deltaCancelledListedPods = ZERO_BI;
    snapshot.cancelledListedPods = marketplace.cancelledListedPods;
    snapshot.deltaAvailableListedPods = ZERO_BI;
    snapshot.availableListedPods = marketplace.availableListedPods;
    snapshot.deltaOrderBeans = ZERO_BI;
    snapshot.orderBeans = marketplace.orderBeans;
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

export function updateExpiredPlots(harvestableIndex: BigInt, diamondAddress: Address, timestamp: BigInt): void {
  let market = loadPodMarketplace(diamondAddress);
  let remainingListings = market.listingIndexes;

  // TODO: expire plot upon harvest rather than the line moving past the start index
  // TODO: consider saving either a separate list or within this list, the indices that they expire
  //    this will prevent having to load every listing upon each season

  // Cancel any pod marketplace listings beyond the index
  for (let i = 0; i < remainingListings.length; i++) {
    // TODO: this needs to be the user account
    let listing = loadPodListing(diamondAddress, remainingListings[i]);
    if (harvestableIndex > listing.maxHarvestableIndex) {
      expirePodListing(diamondAddress, timestamp, remainingListings[i]);
      remainingListings.splice(i--, 1);
    }
  }

  remainingListings.sort();
  market.listingIndexes = remainingListings;
  market.save();
}
