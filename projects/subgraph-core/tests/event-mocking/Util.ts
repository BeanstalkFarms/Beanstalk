import { ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";
import { BEANSTALK } from "../../utils/Constants";

// Default mock to include beanstalk address
export function mockBeanstalkEvent(): ethereum.Event {
  let e = changetype<ethereum.Event>(newMockEvent());
  e.address = BEANSTALK;
  return e;
}
