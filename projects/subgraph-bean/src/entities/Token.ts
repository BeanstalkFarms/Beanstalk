import { Address } from "@graphprotocol/graph-ts";
import { getTokenInfo } from "../utils/constants/PooledTokens";
import { ZERO_BD } from "../../../subgraph-core/utils/Decimals";
import { Token } from "../../generated/schema";

export function loadOrCreateToken(address: Address): Token {
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
