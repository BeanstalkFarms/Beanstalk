import { BigInt, Address, BigDecimal } from "@graphprotocol/graph-ts";
import { loadOrCreatePool } from "../../src/utils/Pool";

export function mockPoolPriceAndLiquidity(poolAddr: Address, price: BigDecimal, liquidityUSD: BigDecimal, blockNumber: BigInt): void {
  let pool = loadOrCreatePool(poolAddr.toHexString(), blockNumber);
  pool.lastPrice = price;
  pool.liquidityUSD = liquidityUSD;
  pool.save();
}
