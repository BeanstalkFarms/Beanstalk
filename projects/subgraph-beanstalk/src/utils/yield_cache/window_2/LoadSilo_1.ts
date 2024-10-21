import { ethereum } from "@graphprotocol/graph-ts";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_7_DAY_10_000 } from "./HistoricSilo_10_000";

export function handleLoadSilo2_1(block: ethereum.Block): void {
  loadSiloCache(SILO_YIELD_7_DAY_10_000);
}
