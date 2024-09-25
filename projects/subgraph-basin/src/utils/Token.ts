import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BI_MAX, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getBeanPrice } from "./BeanstalkPrice";
import { getProtocolToken } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";
import { loadToken } from "../entities/Token";

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
