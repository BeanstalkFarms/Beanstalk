import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { WhitelistToken } from "../../generated/BIP42-SeedGauge/Beanstalk";

import { BEANSTALK } from "../../../subgraph-core/utils/Constants";

// Default mock to include beanstalk address
const mockBeanstalkEvent = (): ethereum.Event => {
  let e = changetype<ethereum.Event>(newMockEvent());
  e.address = BEANSTALK;
  return e;
};

export function createWhitelistTokenEventBIP42(
  token: string,
  selector: string,
  stalkEarnedPerSeason: BigInt,
  stalkIssuedPerBdv: BigInt,
  gpSelector: string,
  lwSelector: string,
  gaugePoints: BigInt,
  optimalPercentDepositedBdv: BigInt
): WhitelistToken {
  let event = changetype<WhitelistToken>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param2 = new ethereum.EventParam("selector", ethereum.Value.fromBytes(Bytes.fromHexString(selector)));
  let param3 = new ethereum.EventParam("stalkEarnedPerSeason", ethereum.Value.fromUnsignedBigInt(stalkEarnedPerSeason));
  let param4 = new ethereum.EventParam("stalkIssuedPerBdv", ethereum.Value.fromUnsignedBigInt(stalkIssuedPerBdv));
  let param5 = new ethereum.EventParam("gpSelector", ethereum.Value.fromBytes(Bytes.fromHexString(gpSelector)));
  let param6 = new ethereum.EventParam("lwSelector", ethereum.Value.fromBytes(Bytes.fromHexString(lwSelector)));
  let param7 = new ethereum.EventParam("gaugePoints", ethereum.Value.fromUnsignedBigInt(gaugePoints));
  let param8 = new ethereum.EventParam("optimalPercentDepositedBdv", ethereum.Value.fromUnsignedBigInt(optimalPercentDepositedBdv));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);
  event.parameters.push(param6);
  event.parameters.push(param7);
  event.parameters.push(param8);

  return event as WhitelistToken;
}
