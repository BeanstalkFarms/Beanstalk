import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Version } from "../../generated/schema";
import { BEANSTALK_BLOCK } from "../../../subgraph-core/utils/Constants";

export function handleInitVersion(block: ethereum.Block): void {
  const versionEntity = new Version("subgraph");
  versionEntity.versionNumber = "2.4.0";
  versionEntity.protocolName = protocolNameForBlockNumber(block.number);
  versionEntity.chain = chainForBlockNumber(block.number);
  versionEntity.save();
}

function protocolNameForBlockNumber(blockNumber: BigInt): string {
  if (blockNumber == BEANSTALK_BLOCK) {
    return "beanstalk";
  }
  throw new Error("Unable to initialize protocol name for this block number");
}

function chainForBlockNumber(blockNumber: BigInt): string {
  if (blockNumber == BEANSTALK_BLOCK) {
    return "ethereum";
  }
  throw new Error("Unable to initialize chain for this block number");
}
