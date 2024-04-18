import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { UniswapV2Pair } from "../../../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { pow, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

// For our single uniswapv2 pool, token 0 is WETH and token 1 is BEAN
export function uniswapV2Reserves(pool: Address): BigInt[] {
  let pair = UniswapV2Pair.bind(pool);

  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return [];
  }
  return [reserves.value.value0, reserves.value.value1];
}

// Returns the current price of beans in a uniswapv2 constant product pool
export function uniswapV2Price(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigDecimal {
  return token2Reserves.times(token2Price).div(beanReserves);
}

// Returns the deltaB in a uniswapv2 constant product pool
export function uniswapV2DeltaB(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigInt {
  if (beanReserves == ZERO_BD) {
    return ZERO_BI;
  }
  const constantProduct = beanReserves.times(token2Reserves);
  const beansAfterSwap = sqrt(constantProduct.times(token2Price));
  const deltaB = beansAfterSwap.minus(beanReserves);
  return BigInt.fromString(deltaB.times(pow(BD_10, 6)).truncate(0).toString());
}
