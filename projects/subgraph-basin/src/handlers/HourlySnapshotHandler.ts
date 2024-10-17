import { ethereum } from "@graphprotocol/graph-ts";
import { checkForSnapshot } from "../utils/Well";
import { toAddress } from "../../../subgraph-core/utils/Bytes";
import { loadOrCreateAquifer } from "../entities/WellComponents";
import { v } from "../utils/constants/Version";
import { getAquifer } from "../../../subgraph-core/constants/RuntimeConstants";

// Used to take hourly snapshots in the absense of pool trading activity.
// This handler should be configured for infrequent polling
export function handleBlock(block: ethereum.Block): void {
  const aquifer = loadOrCreateAquifer(getAquifer(v()));
  const wells = aquifer.wells.load();

  for (let i = 0; i < wells.length; i++) {
    checkForSnapshot(toAddress(wells[i].id), block);
  }
}
