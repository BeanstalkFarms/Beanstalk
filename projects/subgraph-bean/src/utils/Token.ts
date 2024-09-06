import { BigDecimal, Address } from "@graphprotocol/graph-ts";
import { loadOrCreateToken } from "../entities/Token";

export function updateTokenPrice(address: Address, price: BigDecimal): void {
  let token = loadOrCreateToken(address);
  token.lastPriceUSD = price;
  token.save();
}
