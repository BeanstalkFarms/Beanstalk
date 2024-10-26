import { ethereum } from "@graphprotocol/graph-ts";
import { loadTokenCache } from "../CacheLoader";
import { TOKEN_YIELD_24_HOUR_12_000 } from "./HistoricToken_12_000";

export function handleLoadToken1_1(block: ethereum.Block): void {
  loadTokenCache(TOKEN_YIELD_24_HOUR_12_000);
}
