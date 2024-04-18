import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { UniswapV2Pair } from "../../../generated/BeanUniswapV2Pair/UniswapV2Pair";

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
