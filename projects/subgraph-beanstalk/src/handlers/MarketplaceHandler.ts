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
  podListingCancelled,
  podListingCreated,
  podListingFilled,
  podOrderCancelled,
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
  podListingCancelled({
    event,
    account: event.params.account,
    index: event.params.index
  });
}

export function handlePodOrderCancelled(event: PodOrderCancelled): void {
  podOrderCancelled({
    event,
    account: event.params.account,
    id: event.params.id
  });
}
