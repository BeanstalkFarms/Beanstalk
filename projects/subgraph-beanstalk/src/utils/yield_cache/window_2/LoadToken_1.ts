import { ethereum } from "@graphprotocol/graph-ts";
import { loadTokenCache } from "../CacheLoader";
import { TOKEN_YIELD_7_DAY_12_000 } from "./HistoricToken_12_000";

export function handleLoadToken2_1(block: ethereum.Block): void {
  loadTokenCache(TOKEN_YIELD_7_DAY_12_000);
}
