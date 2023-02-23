import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";
import { ERC20 } from "../../generated/Aquifer/ERC20";
import { Token } from "../../generated/schema";
import { CurvePrice } from "../../generated/templates/Well/CurvePrice";
import { BEAN_ERC20, CURVE_PRICE } from "./Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "./Decimals";

export function loadOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress);
  if (token == null) {
    let tokenContract = ERC20.bind(tokenAddress);
    token = new Token(tokenAddress);

    let nameCall = tokenContract.try_name();
    if (nameCall.reverted) token.name = "";
    else token.name = nameCall.value;

    let symbolCall = tokenContract.try_symbol();
    if (symbolCall.reverted) token.symbol = "";
    else token.symbol = symbolCall.value;

    let decimalCall = tokenContract.try_decimals();
    if (decimalCall.reverted) token.decimals = 18; // Default to 18 decimals
    else token.decimals = decimalCall.value;

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
  let token = loadToken(BEAN_ERC20);
  return token.lastPriceUSD;
}

export function getTokenDecimals(tokenAddress: Address): i32 {
  let token = loadToken(tokenAddress);
  return token.decimals;
}

export function updateTokenUSD(tokenAddress: Address, blockNumber: BigInt, beanPrice: BigDecimal = ZERO_BD): void {
  let token = loadToken(tokenAddress);
  if (tokenAddress == BEAN_ERC20) {
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    let curve = curvePrice.try_getCurve();

    if (curve.reverted) {
      return;
    }

    token.lastPriceUSD = toDecimal(curve.value.price);
  } else token.lastPriceUSD = beanPrice.times(getBeanPriceUDSC());
  token.lastPriceBlockNumber = blockNumber;
  token.save();
}
