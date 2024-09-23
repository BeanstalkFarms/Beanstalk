import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AddMigratedDeposit,
  InternalBalanceMigrated,
  MigratedAccountStatus,
  MigratedPlot,
  MigratedPodListing,
  MigratedPodOrder
} from "../../generated/Beanstalk-ABIs/Reseed";
import { mockContractEvent } from "../../../subgraph-core/tests/event-mocking/Util";
import { BEANSTALK as BEANSTALK_ARB } from "../../../subgraph-core/constants/raw/BeanstalkArbConstants";

export function createAddMigratedDepositEvent(
  account: Address,
  token: Address,
  stem: BigInt,
  amount: BigInt,
  bdv: BigInt
): AddMigratedDeposit {
  let event = changetype<AddMigratedDeposit>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(account));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(token));
  let param3 = new ethereum.EventParam("stem", ethereum.Value.fromUnsignedBigInt(stem));
  let param4 = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
  let param5 = new ethereum.EventParam("bdv", ethereum.Value.fromUnsignedBigInt(bdv));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as AddMigratedDeposit;
}

export function createMigratedAccountStatus(
  account: Address,
  token: Address,
  stalk: BigInt,
  roots: BigInt,
  bdv: BigInt,
  lastStem: BigInt
): MigratedAccountStatus {
  let event = changetype<MigratedAccountStatus>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(account));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(token));
  let param3 = new ethereum.EventParam("stalk", ethereum.Value.fromUnsignedBigInt(stalk));
  let param4 = new ethereum.EventParam("roots", ethereum.Value.fromUnsignedBigInt(roots));
  let param5 = new ethereum.EventParam("bdv", ethereum.Value.fromUnsignedBigInt(bdv));
  let param6 = new ethereum.EventParam("lastStem", ethereum.Value.fromUnsignedBigInt(lastStem));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);

  return event as MigratedAccountStatus;
}

export function createMigratedPlotEvent(account: Address, plotIndex: BigInt, pods: BigInt): MigratedPlot {
  let event = changetype<MigratedPlot>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(account));
  let param2 = new ethereum.EventParam("plotIndex", ethereum.Value.fromUnsignedBigInt(plotIndex));
  let param3 = new ethereum.EventParam("pods", ethereum.Value.fromUnsignedBigInt(pods));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);

  return event as MigratedPlot;
}

export function createMigratedPodListingEvent(
  lister: Address,
  fieldId: BigInt,
  index: BigInt,
  start: BigInt,
  podAmount: BigInt,
  pricePerPod: BigInt,
  maxHarvestableIndex: BigInt,
  minFillAmount: BigInt,
  mode: i32
): MigratedPodListing {
  let event = changetype<MigratedPodListing>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("lister", ethereum.Value.fromAddress(lister));
  let param2 = new ethereum.EventParam("fieldId", ethereum.Value.fromUnsignedBigInt(fieldId));
  let param3 = new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index));
  let param4 = new ethereum.EventParam("start", ethereum.Value.fromUnsignedBigInt(start));
  let param5 = new ethereum.EventParam("podAmount", ethereum.Value.fromUnsignedBigInt(podAmount));
  let param6 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param7 = new ethereum.EventParam("maxHarvestableIndex", ethereum.Value.fromUnsignedBigInt(maxHarvestableIndex));
  let param8 = new ethereum.EventParam("minFillAmount", ethereum.Value.fromUnsignedBigInt(minFillAmount));
  let param9 = new ethereum.EventParam("mode", ethereum.Value.fromI32(mode));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);
  event.parameters.push(param8);
  event.parameters.push(param9);

  return event as MigratedPodListing;
}

export function createMigratedPodOrderEvent(
  orderer: Address,
  id: Bytes,
  beanAmount: BigInt,
  fieldId: BigInt,
  pricePerPod: BigInt,
  maxPlaceInLine: BigInt,
  minFillAmount: BigInt
): MigratedPodOrder {
  let event = changetype<MigratedPodOrder>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("orderer", ethereum.Value.fromAddress(orderer));
  let param2 = new ethereum.EventParam("id", ethereum.Value.fromBytes(id));
  let param3 = new ethereum.EventParam("beanAmount", ethereum.Value.fromUnsignedBigInt(beanAmount));
  let param4 = new ethereum.EventParam("fieldId", ethereum.Value.fromUnsignedBigInt(fieldId));
  let param5 = new ethereum.EventParam("pricePerPod", ethereum.Value.fromUnsignedBigInt(pricePerPod));
  let param6 = new ethereum.EventParam("maxPlaceInLine", ethereum.Value.fromUnsignedBigInt(maxPlaceInLine));
  let param7 = new ethereum.EventParam("minFillAmount", ethereum.Value.fromUnsignedBigInt(minFillAmount));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);

  return event as MigratedPodOrder;
}

export function createInternalBalanceMigratedEvent(account: Address, token: Address, delta: BigInt): InternalBalanceMigrated {
  let event = changetype<InternalBalanceMigrated>(mockContractEvent(BEANSTALK_ARB));
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(account));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(token));
  let param3 = new ethereum.EventParam("delta", ethereum.Value.fromUnsignedBigInt(delta));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);

  return event as InternalBalanceMigrated;
}
