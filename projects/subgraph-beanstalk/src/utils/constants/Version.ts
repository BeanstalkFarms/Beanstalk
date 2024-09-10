import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Version } from "../../../generated/schema";
import { BEANSTALK } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { VersionDto } from "../../../../subgraph-core/constants/RuntimeConstants";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";

export function handleInitVersion(block: ethereum.Block): void {
  const versionEntity = new Version("subgraph");
  versionEntity.versionNumber = "3.0.0";
  versionEntity.subgraphName = subgraphNameForBlockNumber(block.number);
  versionEntity.protocolAddress = protocolForBlockNumber(block.number);
  versionEntity.chain = chainForBlockNumber(block.number);
  versionEntity.save();
}

function subgraphNameForBlockNumber(blockNumber: BigInt): string {
  if (blockNumber == BigInt.fromU32(12974075)) {
    return "beanstalk";
  }
  throw new Error("Unable to initialize subgraph name for this block number");
}

function protocolForBlockNumber(blockNumber: BigInt): Address {
  if (blockNumber == BigInt.fromU32(12974075)) {
    return BEANSTALK;
  }
  throw new Error("Unable to initialize protocol address for this block number");
}

function chainForBlockNumber(blockNumber: BigInt): string {
  if (blockNumber == BigInt.fromU32(12974075)) {
    return "ethereum";
  }
  throw new Error("Unable to initialize chain for this block number");
}

export function v(): VersionDto {
  const versionEntity = Version.load("subgraph")!;
  return {
    subgraphName: versionEntity.subgraphName,
    versionNumber: versionEntity.versionNumber,
    protocolAddress: toAddress(versionEntity.protocolAddress),
    chain: versionEntity.chain
  };
}
