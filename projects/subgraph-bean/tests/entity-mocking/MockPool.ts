import { BigInt, Address, BigDecimal } from "@graphprotocol/graph-ts";
import { mockPreReplantBeanEthPriceAndLiquidity } from "../../../subgraph-core/tests/event-mocking/Price";
import { BEAN_WETH_V1, BEANSTALK_BLOCK } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { loadOrCreatePool } from "../../src/entities/Pool";

export function mockPoolPriceAndLiquidity(poolAddr: Address, price: BigDecimal, liquidityUSD: BigDecimal, blockNumber: BigInt): void {
  let pool = loadOrCreatePool(poolAddr, blockNumber);
  pool.lastPrice = price;
  pool.liquidityUSD = liquidityUSD;
  pool.save();
}

export function mockPreReplantBeanEthPriceAndLiquidityWithPoolReserves(
  beanPrice: BigDecimal,
  liquidity: BigDecimal = BigDecimal.fromString("5000000")
): void {
  const reserves = mockPreReplantBeanEthPriceAndLiquidity(beanPrice, liquidity);
  let pool = loadOrCreatePool(BEAN_WETH_V1, BEANSTALK_BLOCK);
  pool.reserves = reserves;
  pool.save();
}
