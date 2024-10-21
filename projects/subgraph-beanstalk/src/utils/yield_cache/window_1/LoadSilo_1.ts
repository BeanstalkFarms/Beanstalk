import { ethereum } from "@graphprotocol/graph-ts";
import { loadSiloCache } from "../CacheLoader";
import { SILO_YIELD_24_HOUR_10_000 } from "./HistoricSilo_10_000";

export function handleLoadSilo1_1(block: ethereum.Block): void {
  loadSiloCache(SILO_YIELD_24_HOUR_10_000);
}
