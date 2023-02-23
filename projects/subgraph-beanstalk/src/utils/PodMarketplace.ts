import { Address, BigInt } from "@graphprotocol/graph-ts";
import { PodMarketplace, PodMarketplaceHourlySnapshot, PodMarketplaceDailySnapshot } from "../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BI } from "./Decimals";
import { loadField } from "./Field";

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
    marketplace.orderedPods = ZERO_BI;
    marketplace.filledOrderedPods = ZERO_BI;
    marketplace.cancelledOrderedPods = ZERO_BI;
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
    snapshot.deltaOrderedPods = ZERO_BI;
    snapshot.orderedPods = marketplace.orderedPods;
    snapshot.deltaFilledOrderedPods = ZERO_BI;
    snapshot.filledOrderedPods = marketplace.filledOrderedPods;
    snapshot.deltaCancelledOrderedPods = ZERO_BI;
    snapshot.cancelledOrderedPods = marketplace.cancelledOrderedPods;
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
    snapshot.deltaOrderedPods = ZERO_BI;
    snapshot.orderedPods = marketplace.orderedPods;
    snapshot.deltaFilledOrderedPods = ZERO_BI;
    snapshot.filledOrderedPods = marketplace.filledOrderedPods;
    snapshot.deltaCancelledOrderedPods = ZERO_BI;
    snapshot.cancelledOrderedPods = marketplace.cancelledOrderedPods;
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
