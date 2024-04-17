import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export enum TWAType {
  UNISWAP,
  CURVE
}

export class DeltaBAndPrice {
  deltaB: BigInt;
  price: BigDecimal;
}

export class DeltaBPriceLiquidity {
  deltaB: BigInt;
  price: BigDecimal;
  liquidity: BigDecimal;
}
