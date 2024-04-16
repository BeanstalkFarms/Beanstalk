import { BigInt } from "@graphprotocol/graph-ts";
import { TwaOracle } from "../../../generated/schema";
import { emptyBigIntArray, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function loadOrCreateTwaOracle(poolAddress: string, blockNumber: BigInt): TwaOracle {
  let twaOracle = TwaOracle.load(poolAddress);
  if (twaOracle == null) {
    twaOracle = new TwaOracle(poolAddress);
    twaOracle.pool = poolAddress;
    twaOracle.priceCumulativeLast = emptyBigIntArray(2);
    twaOracle.lastUpdated = ZERO_BI;
    twaOracle.save();
  }
  return twaOracle as TwaOracle;
}
