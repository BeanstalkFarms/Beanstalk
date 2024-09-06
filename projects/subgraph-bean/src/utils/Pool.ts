import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { ZERO_BD } from "../../../subgraph-core/utils/Decimals";
import { updateInstDeltaB } from "./Bean";
import { checkPoolCross } from "./Cross";
import { DeltaBAndPrice } from "./price/Types";
import { loadOrCreatePool, loadOrCreatePoolDailySnapshot, loadOrCreatePoolHourlySnapshot } from "../entities/Pool";

export function updatePoolValues(
  poolAddress: string,
  volumeBean: BigInt,
  volumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal,
  deltaBeans: BigInt,
  block: ethereum.Block
): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);

  pool.volume = pool.volume.plus(volumeBean);
  pool.volumeUSD = pool.volumeUSD.plus(volumeUSD);
  pool.liquidityUSD = pool.liquidityUSD.plus(deltaLiquidityUSD);
  pool.deltaBeans = deltaBeans;
  pool.save();

  poolHourly.volume = pool.volume;
  poolHourly.volumeUSD = pool.volumeUSD;
  poolHourly.liquidityUSD = pool.liquidityUSD;
  poolHourly.deltaBeans = pool.deltaBeans;
  poolHourly.deltaVolume = poolHourly.deltaVolume.plus(volumeBean);
  poolHourly.deltaVolumeUSD = poolHourly.deltaVolumeUSD.plus(volumeUSD);
  poolHourly.deltaLiquidityUSD = poolHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  if (poolHourly.liquidityUSD.gt(ZERO_BD)) {
    poolHourly.utilization = poolHourly.deltaVolumeUSD.div(poolHourly.liquidityUSD);
  }
  poolHourly.updatedAt = block.timestamp;
  poolHourly.save();

  poolDaily.volume = pool.volume;
  poolDaily.volumeUSD = pool.volumeUSD;
  poolDaily.liquidityUSD = pool.liquidityUSD;
  poolDaily.deltaBeans = pool.deltaBeans;
  poolDaily.deltaVolume = poolDaily.deltaVolume.plus(volumeBean);
  poolDaily.deltaVolumeUSD = poolDaily.deltaVolumeUSD.plus(volumeUSD);
  poolDaily.deltaLiquidityUSD = poolDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  if (poolDaily.liquidityUSD.gt(ZERO_BD)) {
    poolDaily.utilization = poolDaily.deltaVolumeUSD.div(poolDaily.liquidityUSD);
  }
  poolDaily.updatedAt = block.timestamp;
  poolDaily.save();

  updateInstDeltaB(pool.bean, block);
}

export function incrementPoolCross(poolAddress: string, block: ethereum.Block): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);

  pool.crosses += 1;
  pool.save();

  poolHourly.crosses += 1;
  poolHourly.deltaCrosses += 1;
  poolHourly.save();

  poolDaily.crosses += 1;
  poolDaily.deltaCrosses += 1;
  poolDaily.save();
}

export function updatePoolSeason(poolAddress: string, season: i32, block: ethereum.Block): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);

  pool.lastSeason = season;
  poolHourly.season = season;
  poolDaily.season = season;

  pool.save();
  poolHourly.save();
  poolDaily.save();
}

export function updatePoolPrice(poolAddress: string, price: BigDecimal, block: ethereum.Block, checkCross: boolean = true): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);

  let oldPrice = pool.lastPrice;

  pool.lastPrice = price;
  pool.save();

  poolHourly.lastPrice = price;
  poolHourly.save();

  poolDaily.lastPrice = price;
  poolDaily.save();

  if (checkCross) {
    checkPoolCross(poolAddress, oldPrice, price, block);
  }
}

export function setPoolReserves(poolAddress: string, reserves: BigInt[], block: ethereum.Block): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);

  let deltaReserves: BigInt[] = [];
  for (let i = 0; i < reserves.length; ++i) {
    deltaReserves.push(reserves[i].minus(pool.reserves[i]));
  }

  pool.reserves = reserves;
  poolHourly.reserves = reserves;
  poolDaily.reserves = reserves;

  let newHourlyDelta: BigInt[] = [];
  let newDailyDelta: BigInt[] = [];
  for (let i = 0; i < reserves.length; ++i) {
    newHourlyDelta.push(poolHourly.deltaReserves[i].plus(deltaReserves[i]));
    newDailyDelta.push(poolDaily.deltaReserves[i].plus(deltaReserves[i]));
  }

  poolHourly.deltaReserves = newHourlyDelta;
  poolDaily.deltaReserves = newDailyDelta;

  pool.save();
  poolHourly.save();
  poolDaily.save();
}

export function getPoolLiquidityUSD(poolAddress: string, block: ethereum.Block): BigDecimal {
  let pool = loadOrCreatePool(poolAddress, block.number);
  return pool.liquidityUSD;
}

export function setPoolTwa(poolAddress: string, twaValues: DeltaBAndPrice, block: ethereum.Block): void {
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, block);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, block);
  poolHourly.twaDeltaBeans = twaValues.deltaB;
  poolHourly.twaPrice = twaValues.price;
  poolHourly.twaToken2Price = twaValues.token2Price;
  // NOTE: ideally this would be a twa of the entire day
  poolDaily.twaDeltaBeans = twaValues.deltaB;
  poolDaily.twaPrice = twaValues.price;
  poolDaily.twaToken2Price = twaValues.token2Price;
  poolHourly.save();
  poolDaily.save();
}
