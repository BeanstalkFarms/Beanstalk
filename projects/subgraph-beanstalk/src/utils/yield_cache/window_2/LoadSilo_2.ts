import { ethereum } from "@graphprotocol/graph-ts";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_7_DAY_15_000 } from "./HistoricSilo_15_000";

export function handleLoadSilo2_2(block: ethereum.Block): void {
  loadSiloCache(SILO_YIELD_7_DAY_15_000);
}
