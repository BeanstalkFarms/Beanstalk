import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

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
import { mockBeanstalkEvent } from "../../../subgraph-core/tests/event-mocking/Util";

<<<<<<< HEAD
/* V1 Marketplace events */
=======
/** ===== Marketplace V1 Events ===== */
>>>>>>> master
export function createPodListingCreatedEvent(
  account: string,
  index: BigInt,
  start: BigInt,
  amount: BigInt,
  pricePerPod: BigInt,
  maxHarvestableIndex: BigInt,
<<<<<<< HEAD
  toWallet: Boolean
): void {}
export function createPodListingCancelledEvent(account: string, index: BigInt): void {}
export function createPodListingFilledEvent(from: string, to: string, index: BigInt, start: BigInt, amount: BigInt): void {}
export function createPodOrderCreatedEvent(account: string, id: Bytes, amount: BigInt, pricePerPod: BigInt, maxPlaceInLine: BigInt): void {}
export function createPodOrderFilledEvent(from: string, to: string, id: Bytes, index: BigInt, start: BigInt, amount: BigInt): void {}
export function createPodOrderCancelledEvent(account: string, id: Bytes): void {}
=======
  toWallet: boolean
): PodListingCreated_v1 {
  let event = changetype<PodListingCreated_v1>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param3 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param4 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param5 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param6 = new ethereum.EventParam("maxHarvestableIndex", ethereum.Value.fromUnsignedBigInt(maxHarvestableIndex));
  let param7 = new ethereum.EventParam("toWallet", ethereum.Value.fromBoolean(toWallet));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);

  return event as PodListingCreated_v1;
}

export function createPodListingFilledEvent(from: string, to: string, index: BigInt, start: BigInt, amount: BigInt): PodListingFilled_v1 {
  let event = changetype<PodListingFilled_v1>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString(from)));
  let param2 = new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString(to)));
  let param3 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param4 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param5 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as PodListingFilled_v1;
}

export function createPodOrderCreatedEvent(
  account: string,
  id: Bytes,
  podsOrdered: BigInt,
  pricePerPod: BigInt,
  maxPlaceInLine: BigInt
): PodOrderCreated_v1 {
  let event = changetype<PodOrderCreated_v1>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));
  let param3 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(podsOrdered));
  let param4 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param5 = new ethereum.EventParam("maxPlaceInLine", ethereum.Value.fromUnsignedBigInt(maxPlaceInLine));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as PodOrderCreated_v1;
}

export function createPodOrderFilledEvent(
  from: string,
  to: string,
  id: Bytes,
  index: BigInt,
  start: BigInt,
  amount: BigInt
): PodOrderFilled_v1 {
  let event = changetype<PodOrderFilled_v1>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString(from)));
  let param2 = new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString(to)));
  let param3 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));
  let param4 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param5 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param6 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);

  return event as PodOrderFilled_v1;
}
>>>>>>> master

/* V1_1 Marketplace events (on replant) */
export function createPodListingCreatedEvent_v1_1(
  account: string,
  index: BigInt,
  start: BigInt,
  amount: BigInt,
  pricePerPod: BigInt,
  maxHarvestableIndex: BigInt,
  mode: BigInt
<<<<<<< HEAD
): void {}
=======
): PodListingCreated_v1_1 {
  let event = changetype<PodListingCreated_v1_1>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param3 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param4 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param5 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param6 = new ethereum.EventParam("maxHarvestableIndex", ethereum.Value.fromUnsignedBigInt(maxHarvestableIndex));
  let param7 = new ethereum.EventParam("mode", ethereum.Value.fromUnsignedBigInt(mode));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);

  return event as PodListingCreated_v1_1;
}
>>>>>>> master

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
<<<<<<< HEAD
  let event = changetype<PodListingCreated_v2>(newMockEvent());
=======
  let event = changetype<PodListingCreated_v2>(mockBeanstalkEvent());
>>>>>>> master
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param3 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param4 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param5 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param6 = new ethereum.EventParam("maxHarvestableIndex", ethereum.Value.fromUnsignedBigInt(maxHarvestableIndex));
  let param7 = new ethereum.EventParam("minFillAmount", ethereum.Value.fromUnsignedBigInt(minFillAmount));
  let param8 = new ethereum.EventParam("pricingFunction", ethereum.Value.fromBytes(pricingFunction));
  let param9 = new ethereum.EventParam("mode", ethereum.Value.fromUnsignedBigInt(mode));
  let param10 = new ethereum.EventParam("pricingType", ethereum.Value.fromUnsignedBigInt(pricingType));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);
  event.parameters.push(param8);
  event.parameters.push(param9);
  event.parameters.push(param10);

  return event as PodListingCreated_v2;
}

export function createPodListingFilledEvent_v2(
  from: string,
  to: string,
  index: BigInt,
  start: BigInt,
  amount: BigInt,
  costInBeans: BigInt
<<<<<<< HEAD
): void {}
export function createPodOrderCreatedEvent_v2(
  account: string,
  id: Bytes,
  amount: BigInt,
=======
): PodListingFilled_v2 {
  let event = changetype<PodListingFilled_v2>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString(from)));
  let param2 = new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString(to)));
  let param3 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param4 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param5 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param6 = new ethereum.EventParam("costInBeans", ethereum.Value.fromUnsignedBigInt(costInBeans));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);

  return event as PodListingFilled_v2;
}

export function createPodOrderCreatedEvent_v2(
  account: string,
  id: Bytes,
  beanAmount: BigInt,
>>>>>>> master
  pricePerPod: BigInt,
  maxPlaceInLine: BigInt,
  minFillAmount: BigInt,
  pricingFunction: Bytes,
  pricingType: BigInt
<<<<<<< HEAD
): void {}
=======
): PodOrderCreated_v2 {
  let event = changetype<PodOrderCreated_v2>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));
  let param3 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(beanAmount));
  let param4 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param5 = new ethereum.EventParam("maxPlaceInLine", ethereum.Value.fromUnsignedBigInt(maxPlaceInLine));
  let param6 = new ethereum.EventParam("minFillAmount", ethereum.Value.fromUnsignedBigInt(minFillAmount));
  let param7 = new ethereum.EventParam("pricingFunction", ethereum.Value.fromBytes(pricingFunction));
  let param8 = new ethereum.EventParam("pricingType", ethereum.Value.fromUnsignedBigInt(pricingType));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);
  event.parameters.push(param8);

  return event as PodOrderCreated_v2;
}

>>>>>>> master
export function createPodOrderFilledEvent_v2(
  from: string,
  to: string,
  id: Bytes,
  index: BigInt,
  start: BigInt,
  amount: BigInt,
  costInBeans: BigInt
<<<<<<< HEAD
): void {}
=======
): PodOrderFilled_v2 {
  let event = changetype<PodOrderFilled_v2>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString(from)));
  let param2 = new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString(to)));
  let param3 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));
  let param4 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param5 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param6 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param7 = new ethereum.EventParam("costInBeans", ethereum.Value.fromUnsignedBigInt(costInBeans));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);

  return event as PodOrderFilled_v2;
}

/* Cancellation events */
export function createPodOrderCancelledEvent(account: string, id: Bytes): PodOrderCancelled {
  let event = changetype<PodOrderCancelled>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));

  event.parameters.push(param1);
  event.parameters.push(param2);

  return event as PodOrderCancelled;
}

export function createPodListingCancelledEvent(account: string, index: BigInt): PodListingCancelled {
  let event = changetype<PodListingCancelled>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));

  event.parameters.push(param1);
  event.parameters.push(param2);

  return event as PodListingCancelled;
}
>>>>>>> master
