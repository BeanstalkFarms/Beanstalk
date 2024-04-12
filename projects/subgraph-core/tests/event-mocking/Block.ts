import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";

// In practice, block number and timestamp shouldnt matter, but some value must be provided
export function mockBlock(number: BigInt = BigInt.fromI32(19579092), timestamp: BigInt = BigInt.fromU32(1712193759)): ethereum.Block {
  const newBlock = changetype<ethereum.Block>(newMockEvent());
  newBlock.number = number;
  newBlock.timestamp = timestamp;
  return newBlock;
}
