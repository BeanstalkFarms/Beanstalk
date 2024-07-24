<<<<<<< HEAD
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
=======
import { BigDecimal } from "@graphprotocol/graph-ts";
>>>>>>> master
import { Token } from "../../generated/schema";
import { ZERO_BD } from "../../../subgraph-core/utils/Decimals";
import { getTokenInfo } from "../constants/PooledTokens";

export function loadOrCreateToken(address: string): Token {
  let token = Token.load(address);
  if (token == null) {
    const tokenInfo = getTokenInfo(address);
    token = new Token(address);
    token.name = tokenInfo.name;
    token.decimals = tokenInfo.decimals;
    token.lastPriceUSD = ZERO_BD;
    token.save();
  }
  return token as Token;
}

export function updateTokenPrice(address: string, price: BigDecimal): void {
  let token = loadOrCreateToken(address);
  token.lastPriceUSD = price;
  token.save();
}
