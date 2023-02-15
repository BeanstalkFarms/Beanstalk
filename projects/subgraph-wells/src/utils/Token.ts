import { Address } from "@graphprotocol/graph-ts";
import { Token } from "../../generated/schema";

export function loadOrCreateToken(tokenAddress: Address): Token {
    let token = Token.load(tokenAddress)
    if (token == null) {
        token = new Token(tokenAddress)
        token.name = ''
        token.symbol = ''
        token.decimals = 18
        token.save()
    }
    return token as Token
}
