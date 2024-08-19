import { ethereum } from "@graphprotocol/graph-ts";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_30_DAY_20_000 } from "./HistoricSilo_20_000";

export function handleLoadSilo3_3(block: ethereum.Block): void {
  loadSiloCache(SILO_YIELD_30_DAY_20_000);
}
