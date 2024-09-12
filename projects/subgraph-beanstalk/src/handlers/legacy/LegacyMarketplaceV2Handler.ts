import {
  PodListingCreated as PodListingCreated_v2,
  PodListingFilled as PodListingFilled_v2,
  PodOrderCreated as PodOrderCreated_v2,
  PodOrderFilled as PodOrderFilled_v2,
  PodListingCancelled as PodListingCancelled_v2
} from "../../../generated/Beanstalk-ABIs/MarketV2";
import { podListingCancelled, podListingCreated, podListingFilled, podOrderCreated, podOrderFilled } from "../../utils/Marketplace";

// MarketV2 -> Reseed
export function handlePodListingCreated_v2(event: PodListingCreated_v2): void {
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

// MarketV2 -> Reseed
export function handlePodListingFilled_v2(event: PodListingFilled_v2): void {
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

// MarketV2 -> Reseed
export function handlePodOrderCreated_v2(event: PodOrderCreated_v2): void {
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

// MarketV2 -> Reseed
export function handlePodOrderFilled_v2(event: PodOrderFilled_v2): void {
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

// Replanted -> Reseed
export function handlePodListingCancelled_v2(event: PodListingCancelled_v2): void {
  podListingCancelled({
    event,
    account: event.params.account,
    index: event.params.index
  });
}
