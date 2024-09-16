import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { TransferSingle } from "../../generated/Beanstalk-ABIs/Fertilizer";
import { mockBeanstalkEvent } from "../../../subgraph-core/tests/event-mocking/Util";

export function createTransferSingleEvent(operator: Address, from: Address, to: Address, id: BigInt, value: BigInt): TransferSingle {
  let event = changetype<TransferSingle>(mockBeanstalkEvent());
  event.parameters = new Array();

  let param1 = new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator));
  let param2 = new ethereum.EventParam("from", ethereum.Value.fromAddress(from));
  let param3 = new ethereum.EventParam("to", ethereum.Value.fromAddress(to));
  let param4 = new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id));
  let param5 = new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value));

  event.parameters.push(param1);
  event.parameters.push(param2);
  event.parameters.push(param3);
  event.parameters.push(param4);
  event.parameters.push(param5);

  return event as TransferSingle;
}
