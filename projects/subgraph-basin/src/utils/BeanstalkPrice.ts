// Unfortunately this file must be copied across the various subgraph projects. This is due to the codegen
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BeanstalkPrice } from "../../generated/Basin-ABIs/BeanstalkPrice";
import { getBeanstalkPriceAddress } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";
import { toDecimal } from "../../../subgraph-core/utils/Decimals";
import { CurvePrice } from "../../generated/Basin-ABIs/CurvePrice";
import { CURVE_PRICE } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";

// Gets the BeanstalkPrice contract, bound to the appropriate instance of the contract.
export function getBeanstalkPrice(blockNumber: BigInt): BeanstalkPrice {
  return BeanstalkPrice.bind(getBeanstalkPriceAddress(v(), blockNumber));
}

export function getBeanPrice(blockNumber: BigInt): BigDecimal | null {
  let beanstalkPrice = getBeanstalkPrice(blockNumber);
  let price = beanstalkPrice.try_price();
  if (!price.reverted) {
    return toDecimal(price.value.price);
  } else {
    // Fetch price on Curve
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    let curve = curvePrice.try_getCurve();

    if (curve.reverted) {
      return null;
    }
    return toDecimal(curve.value.price);
  }
}
