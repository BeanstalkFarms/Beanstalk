import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings
} from "../../generated/BIP42-SeedGauge/Beanstalk";

import { AddDeposit, RemoveDeposit, RemoveDeposits } from "../../generated/Silo-Replanted/Beanstalk";
import { handleAddDeposit } from "../../src/SiloHandler";
import { BEAN_DECIMALS } from "../../../subgraph-core/utils/Constants";
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

export function createFarmerGerminatingStalkBalanceChangedEvent(account: string, delta: BigInt): FarmerGerminatingStalkBalanceChanged {
  let event = changetype<FarmerGerminatingStalkBalanceChanged>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString(account)));
  let param2 = new ethereum.EventParam("delta", ethereum.Value.fromUnsignedBigInt(delta));

  event.parameters.push(param1);
  event.parameters.push(param2);

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
