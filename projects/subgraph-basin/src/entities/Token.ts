import { Address } from "@graphprotocol/graph-ts";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Token } from "../../generated/schema";
import { ERC20 } from "../../generated/Basin-ABIs/ERC20";

export function loadOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress);
  if (token == null) {
    let tokenContract = ERC20.bind(tokenAddress);
    token = new Token(tokenAddress);

    let nameCall = tokenContract.try_name();
    if (nameCall.reverted) {
      token.name = "";
    } else {
      token.name = nameCall.value;
    }

    let symbolCall = tokenContract.try_symbol();
    if (symbolCall.reverted) {
      token.symbol = "";
    } else {
      token.symbol = symbolCall.value;
    }

    let decimalCall = tokenContract.try_decimals();
    if (decimalCall.reverted) {
      token.decimals = 18; // Default to 18 decimals
    } else {
      token.decimals = decimalCall.value;
    }

    token.lastPriceUSD = ZERO_BD;
    token.lastPriceBlockNumber = ZERO_BI;
    token.save();
  }
  return token as Token;
}

export function loadToken(tokenAddress: Address): Token {
  return Token.load(tokenAddress) as Token;
}
