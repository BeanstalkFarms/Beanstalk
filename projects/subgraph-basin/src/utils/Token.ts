import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/Basin-ABIs/ERC20";
import { Token } from "../../generated/schema";
import { BI_MAX, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getBeanPrice } from "./BeanstalkPrice";
import { getProtocolToken } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";

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

export function getBeanPriceUDSC(): BigDecimal {
  let token = loadToken(getProtocolToken(v(), BI_MAX));
  return token.lastPriceUSD;
}

export function getTokenDecimals(tokenAddress: Address): i32 {
  let token = loadToken(tokenAddress);
  return token.decimals;
}

export function updateTokenUSD(tokenAddress: Address, blockNumber: BigInt, beanPrice: BigDecimal = ZERO_BD): void {
  let token = loadToken(tokenAddress);
  if (tokenAddress == getProtocolToken(v(), BI_MAX)) {
    const beanPrice = getBeanPrice(blockNumber);
    if (beanPrice === null) {
      return;
    }
    token.lastPriceUSD = beanPrice;
  } else {
    token.lastPriceUSD = beanPrice.times(getBeanPriceUDSC());
  }
  token.lastPriceBlockNumber = blockNumber;
  token.save();
}
