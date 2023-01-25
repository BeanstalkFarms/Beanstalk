import { BigInt } from "@graphprotocol/graph-ts";
import { Token } from "../../generated/schema";
import { ZERO_BD } from "./Decimals";

export function loadOrCreateToken(address: string): Token {
    let token = Token.load(address)
    if (token == null) {
        token = new Token(address)
        token.decimals = BigInt.fromString('18')
        token.lastPriceUSD = ZERO_BD
        token.save()
    }
    return token as Token
}
