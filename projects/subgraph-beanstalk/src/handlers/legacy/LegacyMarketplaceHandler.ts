import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  PodListingCreated as PodListingCreated_v1,
  PodListingFilled as PodListingFilled_v1,
  PodOrderCreated as PodOrderCreated_v1,
  PodOrderFilled as PodOrderFilled_v1,
  PodListingCancelled as PodListingCancelled_indexed
} from "../../../generated/Beanstalk-ABIs/PreReplant";
import { PodListingCancelled } from "../../../../subgraph-bean/generated/Bean-ABIs/SeedGauge";
import { PodListingCreated as PodListingCreated_v1_1 } from "../../../generated/Beanstalk-ABIs/Replanted";
import { podListingCancelled, podListingCreated, podListingFilled, podOrderCreated, podOrderFilled } from "../../utils/Marketplace";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { loadPodListing, loadPodOrder } from "../../entities/PodMarketplace";
import { handlePodListingCancelled } from "../MarketplaceHandler";

// PreReplant -> Replanted
export function handlePodListingCreated_v1(event: PodListingCreated_v1): void {
  podListingCreated({
    event: event,
    account: event.params.account,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.toWallet ? 0 : 1,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

// Replanted -> MarketV2
// When Beanstalk was Replanted, event.params.mode was changed from bool to uint8
export function handlePodListingCreated_v1_1(event: PodListingCreated_v1_1): void {
  podListingCreated({
    event: event,
    account: event.params.account,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    pricePerPod: event.params.pricePerPod,
    maxHarvestableIndex: event.params.maxHarvestableIndex,
    mode: event.params.mode,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

// PreReplant -> MarketV2
export function handlePodListingFilled_v1(event: PodListingFilled_v1): void {
  let listing = loadPodListing(event.params.from, event.params.index);
  const beanAmount = BigInt.fromI32(listing.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000));

  podListingFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: null,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: beanAmount
  });
}

// Pre-Replant -> Replanted (but also emitted during the Replant in WTP-3)
// This event has a variety where the second parameter is indexed. Otherwise this event is identical to the other.
export function handlePodListingCancelled_indexed(event: PodListingCancelled_indexed): void {
  podListingCancelled({
    event,
    account: event.params.account,
    index: event.params.index
  });
}

// PreReplant -> MarketV2
export function handlePodOrderCreated_v1(event: PodOrderCreated_v1): void {
  const beanAmount = event.params.amount.times(BigInt.fromI32(event.params.pricePerPod)).div(BigInt.fromString("1000000"));
  podOrderCreated({
    event: event,
    account: event.params.account,
    id: event.params.id,
    beanAmount: beanAmount,
    pricePerPod: event.params.pricePerPod,
    maxPlaceInLine: event.params.maxPlaceInLine,
    minFillAmount: ZERO_BI,
    pricingFunction: null,
    pricingType: 0
  });
}

// PreReplant -> MarketV2
export function handlePodOrderFilled_v1(event: PodOrderFilled_v1): void {
  let order = loadPodOrder(event.params.id);
  let beanAmount = BigInt.fromI32(order.pricePerPod).times(event.params.amount).div(BigInt.fromI32(1000000));

  podOrderFilled({
    event: event,
    from: event.params.from,
    to: event.params.to,
    id: event.params.id,
    index: event.params.index,
    start: event.params.start,
    amount: event.params.amount,
    costInBeans: beanAmount
  });
}
