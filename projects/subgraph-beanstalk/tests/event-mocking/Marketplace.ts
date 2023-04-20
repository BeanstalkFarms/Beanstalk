import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";

import {
    PodListingCancelled,
    PodListingCreated as PodListingCreated_v1,
    PodListingFilled as PodListingFilled_v1,
    PodOrderCancelled,
    PodOrderCreated as PodOrderCreated_v1,
    PodOrderFilled as PodOrderFilled_v1
} from "../../generated/Field/Beanstalk";
import { PodListingCreated as PodListingCreated_v1_1 } from "../../generated/Marketplace-Replanted/Beanstalk";
import {
    PodListingCreated as PodListingCreated_v2,
    PodListingFilled as PodListingFilled_v2,
    PodOrderCreated as PodOrderCreated_v2,
    PodOrderFilled as PodOrderFilled_v2
} from "../../generated/BIP29-PodMarketplace/Beanstalk";

import { BEAN_DECIMALS } from "../../src/utils/Constants";

/* V1 Marketplace events */
export function createPodListingCreatedEvent(account: string, index: BigInt, start: BigInt, amount: BigInt, pricePerPod: BigInt, maxHarvestableIndex: BigInt, toWallet: Boolean): void { }
export function createPodListingCancelledEvent(account: string, index: BigInt): void { }
export function createPodListingFilledEvent(from: string, to: string, index: BigInt, start: BigInt, amount: BigInt): void { }
export function createPodOrderCreatedEvent(account: string, id: Bytes, amount: BigInt, pricePerPod: BigInt, maxPlaceInLine: BigInt): void { }
export function createPodOrderFilledEvent(from: string, to: string, id: Bytes, index: BigInt, start: BigInt, amount: BigInt): void { }
export function createPodOrderCancelledEvent(account: string, id: Bytes): void { }

/* V1_1 Marketplace events (on replant) */
export function createPodListingCreatedEvent_v1_1(account: string, index: BigInt, start: BigInt, amount: BigInt, pricePerPod: BigInt, maxHarvestableIndex: BigInt, mode: BigInt): void { }

/** ===== Marketplace V2 Events ===== */
export function createPodListingCreatedEvent_v2(
    account: string,
    index: BigInt,
    start: BigInt,
    amount: BigInt,
    pricePerPod: BigInt,
    maxHarvestableIndex: BigInt,
    minFillAmount: BigInt,
    pricingFunction: Bytes,
    mode: BigInt,
    pricingType: BigInt
): PodListingCreated_v2 {
    let event = changetype<PodListingCreated_v2>(newMockEvent())
    event.parameters = new Array()

    let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)))
    let param2 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index))
    let param3 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start))
    let param4 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
    let param5 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod))
    let param6 = new ethereum.EventParam("maxHarvestableIndex", ethereum.Value.fromUnsignedBigInt(maxHarvestableIndex))
    let param7 = new ethereum.EventParam("minFillAmount", ethereum.Value.fromUnsignedBigInt(minFillAmount))
    let param8 = new ethereum.EventParam("pricingFunction", ethereum.Value.fromBytes(pricingFunction))
    let param9 = new ethereum.EventParam("mode", ethereum.Value.fromUnsignedBigInt(mode))
    let param10 = new ethereum.EventParam("pricingType", ethereum.Value.fromUnsignedBigInt(pricingType))

    event.parameters.push(param1)
    event.parameters.push(param2)
    event.parameters.push(param3)
    event.parameters.push(param4)
    event.parameters.push(param5)
    event.parameters.push(param6)
    event.parameters.push(param7)
    event.parameters.push(param8)
    event.parameters.push(param9)
    event.parameters.push(param10)

    return event as PodListingCreated_v2
}

export function createPodListingFilledEvent_v2(from: string, to: string, index: BigInt, start: BigInt, amount: BigInt, costInBeans: BigInt): void { }
export function createPodOrderCreatedEvent_v2(account: string, id: Bytes, amount: BigInt, pricePerPod: BigInt, maxPlaceInLine: BigInt, minFillAmount: BigInt, pricingFunction: Bytes, pricingType: BigInt): void { }
export function createPodOrderFilledEvent_v2(from: string, to: string, id: Bytes, index: BigInt, start: BigInt, amount: BigInt, costInBeans: BigInt): void { }
