import { ethereum } from "@graphprotocol/graph-ts";
import { loadTokenCache } from "../CacheLoader";
import { TOKEN_YIELD_30_DAY_20_000 } from "./HistoricToken_20_000";

export function handleLoadToken3_2(block: ethereum.Block): void {
  loadTokenCache(TOKEN_YIELD_30_DAY_20_000);
}
