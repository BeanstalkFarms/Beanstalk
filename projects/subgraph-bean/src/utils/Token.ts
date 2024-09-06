import { BigDecimal } from "@graphprotocol/graph-ts";
import { loadOrCreateToken } from "../entities/Token";

export function updateTokenPrice(address: string, price: BigDecimal): void {
  let token = loadOrCreateToken(address);
  token.lastPriceUSD = price;
  token.save();
}
