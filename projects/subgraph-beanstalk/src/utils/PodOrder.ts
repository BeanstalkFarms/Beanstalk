import { Bytes, BigInt, Address } from "@graphprotocol/graph-ts";
import { PodOrder } from "../../generated/schema";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";

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

// Currently there is no concept of an expired pod order, but there may be in the future
// export function expirePodOrder(diamondAddress: Address, orderId: string, timestamp: BigInt, activeOrderIndex: i32): void {
//   let order = loadPodOrder(Bytes.fromHexString(orderId));
//   order.status = "EXPIRED";
//   order.save();
//
//   let market = loadPodMarketplace(diamondAddress);
//   let marketHourly = loadPodMarketplaceHourlySnapshot(diamondAddress, market.season, timestamp);
//   let marketDaily = loadPodMarketplaceDailySnapshot(diamondAddress, timestamp);
//
//   const expiredBeans = order.beanAmount.minus(order.beanAmountFilled);
//   market.expiredOrderBeans = market.expiredOrderBeans.plus(expiredBeans);
//   market.availableOrderBeans = market.availableOrderBeans.minus(expiredBeans);
//   let activeOrders = market.activeOrders;
//   activeOrders.splice(activeOrderIndex, 1);
//   market.activeOrders = activeOrders;
//   market.save();
//
//   marketHourly.season = market.season;
//   marketHourly.deltaExpiredOrderBeans = marketHourly.deltaExpiredOrderBeans.plus(expiredBeans);
//   marketHourly.expiredOrderBeans = market.expiredListedPods;
//   marketHourly.deltaAvailableOrderBeans = marketHourly.deltaAvailableOrderBeans.minus(expiredBeans);
//   marketHourly.availableOrderBeans = market.availableOrderBeans;
//   marketHourly.save();
//
//   marketDaily.season = market.season;
//   marketDaily.deltaExpiredOrderBeans = marketDaily.deltaExpiredOrderBeans.plus(expiredBeans);
//   marketDaily.expiredOrderBeans = market.expiredListedPods;
//   marketDaily.deltaAvailableOrderBeans = marketDaily.deltaAvailableOrderBeans.minus(expiredBeans);
//   marketDaily.availableOrderBeans = market.availableOrderBeans;
//   marketDaily.save();
// }
