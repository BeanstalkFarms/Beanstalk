import {
  PodListingCreated,
  PodListingFilled,
  PodOrderCreated,
  PodOrderFilled,
  PodListingCancelled,
  PodOrderCancelled
} from "../../generated/Beanstalk-ABIs/Reseed";
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
    account: event.params.lister,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.podAmount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.mode,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handlePodListingFilled(event: PodListingFilled): void {
  podListingFilled({
    event: event,
    from: event.params.lister,
    to: event.params.filler,
    id: null,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.podAmount,
    costInBeans: event.params.costInBeans
  });
}

export function handlePodOrderCreated(event: PodOrderCreated): void {
  podOrderCreated({
    event: event,
    account: event.params.orderer,
    id: event.params.id,
    beanAmount: event.params.beanAmount,
    pricePerPod: event.params.pricePerPod,
    maxPlaceInLine: event.params.maxPlaceInLine,
    minFillAmount: event.params.minFillAmount,
    pricingFunction: null,
    pricingType: 0
  });
}

export function handlePodOrderFilled(event: PodOrderFilled): void {
  podOrderFilled({
    event: event,
    from: event.params.filler,
    to: event.params.orderer,
    id: event.params.id,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.podAmount,
    costInBeans: event.params.costInBeans
  });
}

export function handlePodListingCancelled(event: PodListingCancelled): void {
  podListingCancelled({
    event,
    account: event.params.lister,
    index: event.params.index
  });
}

export function handlePodOrderCancelled(event: PodOrderCancelled): void {
  podOrderCancelled({
    event,
    account: event.params.orderer,
    id: event.params.id
  });
}
