import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { WhitelistToken as WhitelistToken_V2 } from "../../generated/Beanstalk-ABIs/Replanted";
import { WhitelistToken as WhitelistToken_V3 } from "../../generated/Beanstalk-ABIs/SiloV3";
import { WhitelistToken as WhitelistToken_V4 } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { mockBeanstalkEvent } from "../../../subgraph-core/tests/event-mocking/Util";
import { DewhitelistToken } from "../../generated/Beanstalk-ABIs/Reseed";

export function createWhitelistTokenV2Event(token: string, selector: string, seeds: BigInt, stalk: BigInt): WhitelistToken_V2 {
  let event = changetype<WhitelistToken_V2>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param2 = new ethereum.EventParam("selector", ethereum.Value.fromBytes(Bytes.fromHexString(selector)));
  let param3 = new ethereum.EventParam("seeds", ethereum.Value.fromUnsignedBigInt(seeds));
  let param4 = new ethereum.EventParam("stalk", ethereum.Value.fromUnsignedBigInt(stalk));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);

  return event as WhitelistToken_V2;
}

export function createWhitelistTokenV3Event(
  token: string,
  selector: string,
  stalkEarnedPerSeason: BigInt,
  stalk: BigInt
): WhitelistToken_V3 {
  let event = changetype<WhitelistToken_V3>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));
  let param2 = new ethereum.EventParam("selector", ethereum.Value.fromBytes(Bytes.fromHexString(selector)));
  let param3 = new ethereum.EventParam("stalkEarnedPerSeason", ethereum.Value.fromUnsignedBigInt(stalkEarnedPerSeason));
  let param4 = new ethereum.EventParam("stalk", ethereum.Value.fromUnsignedBigInt(stalk));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);

  return event as WhitelistToken_V3;
}

export function createWhitelistTokenV4Event(
  token: string,
  selector: string,
  stalkEarnedPerSeason: BigInt,
  stalkIssuedPerBdv: BigInt,
  gpSelector: string,
  lwSelector: string,
  gaugePoints: BigInt,
  optimalPercentDepositedBdv: BigInt
): WhitelistToken_V4 {
  let event = changetype<WhitelistToken_V4>(mockBeanstalkEvent());
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

  return event as WhitelistToken_V4;
}

export function createDewhitelistTokenEvent(token: string): DewhitelistToken {
  let event = changetype<DewhitelistToken>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(token)));

  event.parameters.push(param1);

  return event as DewhitelistToken;
}
