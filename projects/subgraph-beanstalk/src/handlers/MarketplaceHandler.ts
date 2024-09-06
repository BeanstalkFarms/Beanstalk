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
  podListingCancelled,
  podListingCreated,
  podListingFilled,
  podOrderCancelled,
  podOrderCreated,
  podOrderFilled
} from "../utils/Marketplace";

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
