import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings,
  TotalGerminatingStalkChanged,
  TotalStalkChangedFromGermination
} from "../../generated/BIP45-SeedGauge/Beanstalk";

import { BEANSTALK } from "../../../subgraph-core/utils/Constants";

// Default mock to include beanstalk address
const mockBeanstalkEvent = (): ethereum.Event => {
  let e = changetype<ethereum.Event>(newMockEvent());
  e.address = BEANSTALK;
  return e;
};

export function createBeanToMaxLpGpPerBdvRatioChangeEvent(
  season: BigInt,
  caseId: BigInt,
  absChange: BigInt
): BeanToMaxLpGpPerBdvRatioChange {
  let event = changetype<BeanToMaxLpGpPerBdvRatioChange>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("season", ethereum.Value.fromUnsignedBigInt(season));
  let param2 = new ethereum.EventParam("caseId", ethereum.Value.fromUnsignedBigInt(caseId));
  let param3 = new ethereum.EventParam("absChange", ethereum.Value.fromUnsignedBigInt(absChange));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);

  return event as BeanToMaxLpGpPerBdvRatioChange;
}

export function createGaugePointChangeEvent(season: BigInt, token: string, gaugePoints: BigInt): GaugePointChange {
  let event = changetype<GaugePointChange>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("season", ethereum.Value.fromUnsignedBigInt(season));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param3 = new ethereum.EventParam("gaugePoints", ethereum.Value.fromUnsignedBigInt(gaugePoints));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);

  return event as GaugePointChange;
}

export function createUpdateAverageStalkPerBdvPerSeasonEvent(newStalkPerBdvPerSeason: BigInt): UpdateAverageStalkPerBdvPerSeason {
  let event = changetype<UpdateAverageStalkPerBdvPerSeason>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("newStalkPerBdvPerSeason", ethereum.Value.fromUnsignedBigInt(newStalkPerBdvPerSeason));

  event.parameters.push(param1);

  return event as UpdateAverageStalkPerBdvPerSeason;
}

export function createFarmerGerminatingStalkBalanceChangedEvent(
  account: string,
  deltaGerminatingStalk: BigInt,
  germinationState: u32
): FarmerGerminatingStalkBalanceChanged {
  let event = changetype<FarmerGerminatingStalkBalanceChanged>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("deltaGerminatingStalk", ethereum.Value.fromUnsignedBigInt(deltaGerminatingStalk));
  let param3 = new ethereum.EventParam("germinationState", ethereum.Value.fromUnsignedBigInt(BigInt.fromU32(germinationState)));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);

  return event as FarmerGerminatingStalkBalanceChanged;
}

export function createTotalGerminatingBalanceChangedEvent(
  season: BigInt,
  token: string,
  delta: BigInt,
  deltaBdv: BigInt
): TotalGerminatingBalanceChanged {
  let event = changetype<TotalGerminatingBalanceChanged>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("season", ethereum.Value.fromUnsignedBigInt(season));
  let param2 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param3 = new ethereum.EventParam("delta", ethereum.Value.fromUnsignedBigInt(delta));
  let param4 = new ethereum.EventParam("deltaBdv", ethereum.Value.fromUnsignedBigInt(deltaBdv));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);

  return event as TotalGerminatingBalanceChanged;
}

export function createTotalGerminatingStalkChangedEvent(
  germinationSeason: BigInt,
  deltaGerminatingStalk: BigInt
): TotalGerminatingStalkChanged {
  let event = changetype<TotalGerminatingStalkChanged>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("germinationSeason", ethereum.Value.fromUnsignedBigInt(germinationSeason));
  let param2 = new ethereum.EventParam("deltaGerminatingStalk", ethereum.Value.fromUnsignedBigInt(deltaGerminatingStalk));

  event.parameters.push(param1);
  event.parameters.push(param2);

  return event as TotalGerminatingStalkChanged;
}

export function createTotalStalkChangedFromGerminationEvent(deltaStalk: BigInt, deltaRoots: BigInt): TotalStalkChangedFromGermination {
  let event = changetype<TotalStalkChangedFromGermination>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("deltaStalk", ethereum.Value.fromUnsignedBigInt(deltaStalk));
  let param2 = new ethereum.EventParam("deltaRoots", ethereum.Value.fromUnsignedBigInt(deltaRoots));

  event.parameters.push(param1);
  event.parameters.push(param2);

  return event as TotalStalkChangedFromGermination;
}

export function createUpdateGaugeSettingsEvent(
  token: string,
  gpSelector: string,
  lwSelector: string,
  optimalPercentDepositedBdv: BigInt
): UpdateGaugeSettings {
  let event = changetype<UpdateGaugeSettings>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param2 = new ethereum.EventParam("gpSelector", ethereum.Value.fromBytes(Bytes.fromHexString(gpSelector)));
  let param3 = new ethereum.EventParam("lwSelector", ethereum.Value.fromBytes(Bytes.fromHexString(lwSelector)));
  let param4 = new ethereum.EventParam("optimalPercentDepositedBdv", ethereum.Value.fromUnsignedBigInt(optimalPercentDepositedBdv));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);

  return event as UpdateGaugeSettings;
}
