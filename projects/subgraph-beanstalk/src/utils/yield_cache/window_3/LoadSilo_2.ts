import { ethereum } from "@graphprotocol/graph-ts";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_30_DAY_15_000 } from "./HistoricSilo_15_000";

export function handleLoadSilo3_2(block: ethereum.Block): void {
  loadSiloCache(SILO_YIELD_30_DAY_15_000);
}
