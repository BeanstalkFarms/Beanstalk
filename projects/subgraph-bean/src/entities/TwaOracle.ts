import { Address, Bytes } from "@graphprotocol/graph-ts";
import { emptyBigIntArray, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { TwaOracle } from "../../generated/schema";

export function loadOrCreateTwaOracle(poolAddress: Address): TwaOracle {
  let twaOracle = TwaOracle.load(poolAddress);
  if (twaOracle == null) {
    twaOracle = new TwaOracle(poolAddress);
    twaOracle.pool = poolAddress;
    twaOracle.priceCumulativeSun = emptyBigIntArray(2);
    twaOracle.lastSun = ZERO_BI;
    twaOracle.priceCumulativeLast = emptyBigIntArray(2);
    twaOracle.lastBalances = emptyBigIntArray(2);
    twaOracle.lastUpdated = ZERO_BI;
    twaOracle.cumulativeWellReserves = Bytes.empty();
    twaOracle.cumulativeWellReservesTime = ZERO_BI;
    twaOracle.cumulativeWellReservesBlock = ZERO_BI;
    twaOracle.cumulativeWellReservesPrev = Bytes.empty();
    twaOracle.cumulativeWellReservesPrevTime = ZERO_BI;
    twaOracle.cumulativeWellReservesPrevBlock = ZERO_BI;
    twaOracle.save();
  }
  return twaOracle as TwaOracle;
}
