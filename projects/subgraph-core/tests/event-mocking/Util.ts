import { Address, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { BEANSTALK } from "../../utils/Constants";

// Default mock to include beanstalk address
export function mockBeanstalkEvent(): ethereum.Event {
  return mockContractEvent(BEANSTALK);
}

export function mockContractEvent(contract: Address): ethereum.Event {
  let e = changetype<ethereum.Event>(newMockEvent());
  e.address = contract;
  return e;
}
