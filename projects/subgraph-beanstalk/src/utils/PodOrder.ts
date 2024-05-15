import { Bytes, BigInt, Address } from "@graphprotocol/graph-ts";
import { PodOrder } from "../../generated/schema";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadPodMarketplace, loadPodMarketplaceDailySnapshot, loadPodMarketplaceHourlySnapshot } from "./PodMarketplace";

export function loadPodOrder(orderID: Bytes): PodOrder {
  let order = PodOrder.load(orderID.toHexString());
  if (order == null) {
    order = new PodOrder(orderID.toHexString());
    order.podMarketplace = BEANSTALK.toHexString();
    order.historyID = "";
    order.farmer = "";
    order.createdAt = ZERO_BI;
    order.updatedAt = ZERO_BI;
    order.status = "";
    order.beanAmount = ZERO_BI;
    order.podAmountFilled = ZERO_BI;
    order.beanAmountFilled = ZERO_BI;
    order.minFillAmount = ZERO_BI;
    order.maxPlaceInLine = ZERO_BI;
    order.pricePerPod = 0;
    order.creationHash = "";
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

export function expirePodOrder(diamondAddress: Address, orderId: string, timestamp: BigInt, activeListingIndex: i32): void {
  // let order = loadPodOrder(Bytes.fromHexString(orderId));
  // let market = loadPodMarketplace(diamondAddress);
  // let marketHourly = loadPodMarketplaceHourlySnapshot(diamondAddress, market.season, timestamp);
  // let marketDaily = loadPodMarketplaceDailySnapshot(diamondAddress, timestamp);
  // const expiredBeans = order.beanAmount.minus(order.beanAmountFilled);
  // market.expiredOrderBeans = market.expiredOrderBeans.plus(expiredBeans);
  // ///
  // market.availableListedPods = market.availableListedPods.minus(listing.remainingAmount);
  // let activeListings = market.activeListings;
  // activeListings.splice(activeListingIndex, 1);
  // market.activeListings = activeListings;
  // market.save();
  // marketHourly.season = market.season;
  // marketHourly.deltaExpiredListedPods = marketHourly.deltaExpiredListedPods.plus(listing.remainingAmount);
  // marketHourly.expiredListedPods = market.expiredListedPods;
  // marketHourly.deltaAvailableListedPods = marketHourly.deltaAvailableListedPods.minus(listing.remainingAmount);
  // marketHourly.availableListedPods = market.availableListedPods;
  // marketHourly.save();
  // marketDaily.season = market.season;
  // marketDaily.deltaExpiredListedPods = marketDaily.deltaExpiredListedPods.plus(listing.remainingAmount);
  // marketDaily.expiredListedPods = market.expiredListedPods;
  // marketDaily.deltaAvailableListedPods = marketDaily.deltaAvailableListedPods.minus(listing.remainingAmount);
  // marketDaily.availableListedPods = market.availableListedPods;
  // marketDaily.save();
  // listing.status = "EXPIRED";
  // listing.remainingAmount = ZERO_BI;
  // listing.save();
  /**
 * let listing = PodListing.load(farmer + "-" + listedPlotIndex.toString());
  if (listing == null || listing.status != "ACTIVE") {
    return;
  }

  let market = loadPodMarketplace(diamondAddress);

  if (activeListingIndex == -1) {
    // There should always be a matching entry in this list because it is verified that the listing is ACTIVE
    for (let i = 0; i < market.activeListings.length; i++) {
      const destructured = market.activeListings[i].split("-");
      // Unnecessary to check if the account matches.
      if (destructured[1] == listedPlotIndex.toString()) {
        activeListingIndex = i;
        break;
      }
    }
  }

  let marketHourly = loadPodMarketplaceHourlySnapshot(diamondAddress, market.season, timestamp);
  let marketDaily = loadPodMarketplaceDailySnapshot(diamondAddress, timestamp);

  market.expiredListedPods = market.expiredListedPods.plus(listing.remainingAmount);
  market.availableListedPods = market.availableListedPods.minus(listing.remainingAmount);
  let activeListings = market.activeListings;
  activeListings.splice(activeListingIndex, 1);
  market.activeListings = activeListings;
  market.save();

  marketHourly.season = market.season;
  marketHourly.deltaExpiredListedPods = marketHourly.deltaExpiredListedPods.plus(listing.remainingAmount);
  marketHourly.expiredListedPods = market.expiredListedPods;
  marketHourly.deltaAvailableListedPods = marketHourly.deltaAvailableListedPods.minus(listing.remainingAmount);
  marketHourly.availableListedPods = market.availableListedPods;
  marketHourly.save();

  marketDaily.season = market.season;
  marketDaily.deltaExpiredListedPods = marketDaily.deltaExpiredListedPods.plus(listing.remainingAmount);
  marketDaily.expiredListedPods = market.expiredListedPods;
  marketDaily.deltaAvailableListedPods = marketDaily.deltaAvailableListedPods.minus(listing.remainingAmount);
  marketDaily.availableListedPods = market.availableListedPods;
  marketDaily.save();

  listing.status = "EXPIRED";
  listing.remainingAmount = ZERO_BI;
  listing.save();
 */
}
