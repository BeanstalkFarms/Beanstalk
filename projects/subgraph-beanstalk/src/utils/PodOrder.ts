import { Bytes } from "@graphprotocol/graph-ts";
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
    order.podAmount = ZERO_BI;
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
      newOrder.podAmount = order.podAmount;
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
