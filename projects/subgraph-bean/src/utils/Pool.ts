import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Pool, PoolDailySnapshot, PoolHourlySnapshot } from "../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { emptyBigIntArray, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getBeanTokenAddress, loadBean, updateInstDeltaB } from "./Bean";
import { checkPoolCross } from "./Cross";
import { DeltaBAndPrice } from "./price/Types";

export function loadOrCreatePool(poolAddress: string, blockNumber: BigInt): Pool {
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    let beanAddress = getBeanTokenAddress(blockNumber);
    let bean = loadBean(beanAddress);

    pool = new Pool(poolAddress);
    pool.bean = beanAddress;
    pool.reserves = emptyBigIntArray(2);
    pool.lastSeason = bean.lastSeason;
    pool.lastPrice = ZERO_BD;
    pool.volume = ZERO_BI;
    pool.volumeUSD = ZERO_BD;
    pool.liquidityUSD = ZERO_BD;
    pool.crosses = 0;
    pool.lastCross = ZERO_BI;
    pool.deltaBeans = ZERO_BI;
    pool.save();

    // Add new pool to the Bean entity
    let pools = bean.pools;
    pools.push(poolAddress);
    bean.pools = pools;
    bean.save();
  }
  return pool as Pool;
}

export function loadOrCreatePoolHourlySnapshot(pool: string, timestamp: BigInt, blockNumber: BigInt): PoolHourlySnapshot {
  let hour = hourFromTimestamp(timestamp).toString();
  let id = pool + "-" + hour;
  let snapshot = PoolHourlySnapshot.load(id);
  if (snapshot == null) {
    let currentPool = loadOrCreatePool(pool, blockNumber);
    snapshot = new PoolHourlySnapshot(id);
    snapshot.pool = pool;
    snapshot.reserves = currentPool.reserves;
    snapshot.lastPrice = currentPool.lastPrice;
    snapshot.twaPrice = ZERO_BD;
    snapshot.volume = currentPool.volume;
    snapshot.volumeUSD = currentPool.volumeUSD;
    snapshot.liquidityUSD = currentPool.liquidityUSD;
    snapshot.crosses = currentPool.crosses;
    snapshot.utilization = ZERO_BD;
    snapshot.deltaBeans = ZERO_BI;
    snapshot.twaDeltaBeans = ZERO_BI;
    snapshot.deltaReserves = emptyBigIntArray(2);
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = currentPool.lastSeason;
    snapshot.createdAt = timestamp;
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as PoolHourlySnapshot;
}

export function loadOrCreatePoolDailySnapshot(pool: string, timestamp: BigInt, blockNumber: BigInt): PoolDailySnapshot {
  let day = dayFromTimestamp(timestamp).toString();

  let id = pool + "-" + day;
  let snapshot = PoolDailySnapshot.load(id);
  if (snapshot == null) {
    let currentPool = loadOrCreatePool(pool, blockNumber);
    snapshot = new PoolDailySnapshot(id);
    snapshot.pool = pool;
    snapshot.reserves = currentPool.reserves;
    snapshot.lastPrice = currentPool.lastPrice;
    snapshot.twaPrice = ZERO_BD;
    snapshot.volume = currentPool.volume;
    snapshot.volumeUSD = currentPool.volumeUSD;
    snapshot.liquidityUSD = currentPool.liquidityUSD;
    snapshot.crosses = currentPool.crosses;
    snapshot.utilization = ZERO_BD;
    snapshot.deltaBeans = ZERO_BI;
    snapshot.twaDeltaBeans = ZERO_BI;
    snapshot.deltaReserves = emptyBigIntArray(2);
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = currentPool.lastSeason;
    snapshot.createdAt = timestamp;
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as PoolDailySnapshot;
}

export function updatePoolValues(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  volumeBean: BigInt,
  volumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal,
  deltaBeans: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);

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
  poolHourly.utilization = poolHourly.deltaVolumeUSD.div(poolHourly.liquidityUSD);
  poolHourly.updatedAt = timestamp;
  poolHourly.save();

  poolDaily.volume = pool.volume;
  poolDaily.volumeUSD = pool.volumeUSD;
  poolDaily.liquidityUSD = pool.liquidityUSD;
  poolDaily.deltaBeans = pool.deltaBeans;
  poolDaily.deltaVolume = poolDaily.deltaVolume.plus(volumeBean);
  poolDaily.deltaVolumeUSD = poolDaily.deltaVolumeUSD.plus(volumeUSD);
  poolDaily.deltaLiquidityUSD = poolDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  poolDaily.utilization = poolDaily.deltaVolumeUSD.div(poolDaily.liquidityUSD);
  poolDaily.updatedAt = timestamp;
  poolDaily.save();

  updateInstDeltaB(pool.bean, blockNumber, timestamp);
}

export function incrementPoolCross(poolAddress: string, timestamp: BigInt, blockNumber: BigInt): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);

  pool.crosses += 1;
  pool.save();

  poolHourly.crosses += 1;
  poolHourly.deltaCrosses += 1;
  poolHourly.save();

  poolDaily.crosses += 1;
  poolDaily.deltaCrosses += 1;
  poolDaily.save();
}

export function updatePoolSeason(poolAddress: string, timestamp: BigInt, blockNumber: BigInt, season: i32): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);

  pool.lastSeason = season;
  poolHourly.season = season;
  poolDaily.season = season;

  pool.save();
  poolHourly.save();
  poolDaily.save();
}

export function updatePoolPrice(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  price: BigDecimal,
  checkCross: boolean = true
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);

  let oldPrice = pool.lastPrice;

  pool.lastPrice = price;
  pool.save();

  poolHourly.lastPrice = price;
  poolHourly.save();

  poolDaily.lastPrice = price;
  poolDaily.save();

  if (checkCross) {
    checkPoolCross(poolAddress, timestamp, blockNumber, oldPrice, price);
  }
}

export function setPoolReserves(poolAddress: string, reserves: BigInt[], timestamp: BigInt, blockNumber: BigInt): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);

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

export function getPoolLiquidityUSD(poolAddress: string, blockNumber: BigInt): BigDecimal {
  let pool = loadOrCreatePool(poolAddress, blockNumber);
  return pool.liquidityUSD;
}

export function setPoolTwa(poolAddress: string, twaValues: DeltaBAndPrice, timestamp: BigInt, blockNumber: BigInt): void {
  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);
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
