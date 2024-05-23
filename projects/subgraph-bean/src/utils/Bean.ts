import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Bean, BeanDailySnapshot, BeanHourlySnapshot, Pool } from "../../generated/schema";
import {
  BEAN_3CRV,
  BEAN_ERC20_V1,
  BEAN_ERC20,
  BEAN_WETH_V1,
  BEAN_WETH_CP2_WELL,
  BEAN_3CRV_V1,
  BEAN_LUSD_V1
} from "../../../subgraph-core/utils/Constants";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { checkBeanCross, getV1Crosses } from "./Cross";
import { loadOrCreatePool, loadOrCreatePoolHourlySnapshot } from "./Pool";
import { BeanstalkPrice_try_price, BeanstalkPriceResult } from "./price/BeanstalkPrice";
import { calcLockedBeans } from "./LockedBeans";

export function loadBean(token: string): Bean {
  let bean = Bean.load(token);
  if (bean == null) {
    bean = new Bean(token);
    bean.supply = ZERO_BI;
    bean.marketCap = ZERO_BD;
    bean.lockedBeans = ZERO_BI;
    bean.supplyInPegLP = ZERO_BD;
    bean.volume = ZERO_BI;
    bean.volumeUSD = ZERO_BD;
    bean.liquidityUSD = ZERO_BD;
    bean.price = BigDecimal.fromString("1.072");
    bean.crosses = token == BEAN_ERC20.toHexString() ? getV1Crosses() : 0; // starting point for v2 is where v1 left off
    bean.lastCross = ZERO_BI;
    bean.lastSeason = token == BEAN_ERC20.toHexString() ? 6074 : 0;
    bean.pools = [];
    bean.dewhitelistedPools = [];
    bean.save();
  }
  return bean as Bean;
}

export function loadOrCreateBeanHourlySnapshot(
  token: string,
  timestamp: BigInt,
  season: i32
): BeanHourlySnapshot {
  let id = token + "-" + season.toString();
  let snapshot = BeanHourlySnapshot.load(id);
  if (snapshot == null) {
    let bean = loadBean(token);
    snapshot = new BeanHourlySnapshot(id);
    snapshot.bean = bean.id;
    snapshot.supply = bean.supply;
    snapshot.marketCap = bean.marketCap;
    snapshot.lockedBeans = bean.lockedBeans;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.instantaneousDeltaB = ZERO_BI;
    snapshot.twaDeltaB = ZERO_BI;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.twaPrice = ZERO_BD;
    snapshot.crosses = bean.crosses;
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = bean.lastSeason;
    snapshot.timestamp = timestamp;
    snapshot.blockNumber = ZERO_BI;
    snapshot.save();
  }
  return snapshot as BeanHourlySnapshot;
}

export function loadOrCreateBeanDailySnapshot(token: string, timestamp: BigInt): BeanDailySnapshot {
  let day = dayFromTimestamp(timestamp).toString();
  let snapshot = BeanDailySnapshot.load(day);
  if (snapshot == null) {
    let bean = loadBean(token);
    snapshot = new BeanDailySnapshot(day);
    snapshot.bean = bean.id;
    snapshot.supply = bean.supply;
    snapshot.marketCap = bean.marketCap;
    snapshot.lockedBeans = bean.lockedBeans;
    snapshot.supplyInPegLP = bean.supplyInPegLP;
    snapshot.instantaneousDeltaB = ZERO_BI;
    snapshot.twaDeltaB = ZERO_BI;
    snapshot.volume = bean.volume;
    snapshot.volumeUSD = bean.volumeUSD;
    snapshot.liquidityUSD = bean.liquidityUSD;
    snapshot.price = bean.price;
    snapshot.twaPrice = ZERO_BD;
    snapshot.crosses = bean.crosses;
    snapshot.deltaVolume = ZERO_BI;
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaCrosses = 0;
    snapshot.season = bean.lastSeason;
    snapshot.timestamp = timestamp;
    snapshot.blockNumber = ZERO_BI;
    snapshot.save();
  }
  return snapshot as BeanDailySnapshot;
}

export function updateBeanValues(
  token: string,
  timestamp: BigInt,
  newPrice: BigDecimal | null,
  deltaSupply: BigInt,
  deltaVolume: BigInt,
  deltaVolumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal
): void {
  let bean = loadBean(token);
  if (newPrice !== null) {
    bean.price = newPrice;
  }
  bean.supply = bean.supply.plus(deltaSupply);
  bean.marketCap = toDecimal(bean.supply).times(bean.price);
  bean.volume = bean.volume.plus(deltaVolume);
  bean.volumeUSD = bean.volumeUSD.plus(deltaVolumeUSD);
  bean.liquidityUSD = bean.liquidityUSD.plus(deltaLiquidityUSD);
  bean.save();

  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

  beanHourly.volume = bean.volume;
  beanHourly.volumeUSD = bean.volumeUSD;
  beanHourly.liquidityUSD = bean.liquidityUSD;
  beanHourly.supply = bean.supply;
  beanHourly.marketCap = bean.marketCap;
  beanHourly.lockedBeans = bean.lockedBeans;
  beanHourly.supplyInPegLP = bean.supplyInPegLP;
  beanHourly.deltaVolume = beanHourly.deltaVolume.plus(deltaVolume);
  beanHourly.deltaVolumeUSD = beanHourly.deltaVolumeUSD.plus(deltaVolumeUSD);
  beanHourly.deltaLiquidityUSD = beanHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  beanHourly.save();

  beanDaily.volume = bean.volume;
  beanDaily.volumeUSD = bean.volumeUSD;
  beanDaily.liquidityUSD = bean.liquidityUSD;
  beanDaily.supply = bean.supply;
  beanDaily.marketCap = bean.marketCap;
  beanDaily.lockedBeans = bean.lockedBeans;
  beanDaily.supplyInPegLP = bean.supplyInPegLP;
  beanDaily.deltaVolume = beanDaily.deltaVolume.plus(deltaVolume);
  beanDaily.deltaVolumeUSD = beanDaily.deltaVolumeUSD.plus(deltaVolumeUSD);
  beanDaily.deltaLiquidityUSD = beanDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD);
  beanDaily.save();
}

export function updateBeanSeason(token: string, timestamp: BigInt, season: i32): void {
  let bean = loadBean(token);
  bean.lastSeason = season;
  bean.save();

  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, season);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

  beanHourly.season = season;
  beanHourly.save();

  beanDaily.season = season;
  beanDaily.save();
}

// Returns the last stored bean price
export function getLastBeanPrice(token: string): BigDecimal {
  let bean = loadBean(token);
  return bean.price;
}

// Returns the liquidity-weighted bean price across all of the whitelisted pools.
export function calcLiquidityWeightedBeanPrice(token: string): BigDecimal {
  let bean = loadBean(token);
  let weightedPrice = ZERO_BD;
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < bean.pools.length; ++i) {
    let pool = Pool.load(bean.pools[i])!;
    weightedPrice = weightedPrice.plus(pool.lastPrice.times(pool.liquidityUSD));
    // log.debug("price | liquidity {} | {}", [pool.lastPrice.toString(), pool.liquidityUSD.toString()]);
    totalLiquidity = totalLiquidity.plus(pool.liquidityUSD);
  }
  return weightedPrice.div(totalLiquidity == ZERO_BD ? ONE_BD : totalLiquidity);
}

export function getBeanTokenAddress(blockNumber: BigInt): string {
  return blockNumber < BigInt.fromString("15278082")
    ? BEAN_ERC20_V1.toHexString()
    : BEAN_ERC20.toHexString();
}

export function updateBeanSupplyPegPercent(blockNumber: BigInt): void {
  if (blockNumber < BigInt.fromString("15278082")) {
    let bean = loadBean(BEAN_ERC20_V1.toHexString());
    let lpSupply = ZERO_BD;

    let pool = Pool.load(BEAN_WETH_V1.toHexString());
    if (pool != null) {
      lpSupply = lpSupply.plus(toDecimal(pool.reserves[1]));
    }

    pool = Pool.load(BEAN_3CRV_V1.toHexString());
    if (pool != null) {
      lpSupply = lpSupply.plus(toDecimal(pool.reserves[0]));
    }

    pool = Pool.load(BEAN_LUSD_V1.toHexString());
    if (pool != null) {
      lpSupply = lpSupply.plus(toDecimal(pool.reserves[0]));
    }

    bean.supplyInPegLP = lpSupply.div(toDecimal(bean.supply));
    bean.save();
  } else {
    let bean = loadBean(BEAN_ERC20.toHexString());
    let pegSupply = ZERO_BI;
    for (let i = 0; i < bean.pools.length; ++i) {
      let pool = loadOrCreatePool(bean.pools[i], blockNumber);
      // Assumption that beans is in the 0 index for all pools, this may need to be revisited.
      pegSupply = pegSupply.plus(pool.reserves[0]);
    }
    bean.lockedBeans = calcLockedBeans(blockNumber);
    bean.supplyInPegLP = toDecimal(pegSupply).div(toDecimal(bean.supply.minus(bean.lockedBeans)));
    bean.save();
  }
}

// Update bean information if the pool is still whitelisted
export function updateBeanAfterPoolSwap(
  poolAddress: string,
  poolPrice: BigDecimal,
  volumeBean: BigInt,
  volumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal,
  timestamp: BigInt,
  blockNumber: BigInt,
  priceContractResult: BeanstalkPriceResult | null = null
): void {
  let bean = loadBean(BEAN_ERC20.toHexString());
  if (bean.pools.indexOf(poolAddress) >= 0) {
    let oldBeanPrice = bean.price;
    let beanPrice = poolPrice;

    // Get overall price from price contract if a result was not already provided
    if (priceContractResult === null) {
      priceContractResult = BeanstalkPrice_try_price(BEAN_ERC20, blockNumber);
    }
    if (!priceContractResult.reverted) {
      beanPrice = toDecimal(priceContractResult.value.price);
    }

    updateBeanSupplyPegPercent(blockNumber);
    updateBeanValues(
      BEAN_ERC20.toHexString(),
      timestamp,
      beanPrice,
      ZERO_BI,
      volumeBean,
      volumeUSD,
      deltaLiquidityUSD
    );
    checkBeanCross(BEAN_ERC20.toHexString(), timestamp, blockNumber, oldBeanPrice, beanPrice);
  }
}

export function updateInstDeltaB(token: string, blockNumber: BigInt, timestamp: BigInt): void {
  let bean = loadBean(token);
  let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp);

  let cumulativeDeltaB = ZERO_BI;
  for (let i = 0; i < bean.pools.length; i++) {
    let pool = loadOrCreatePool(bean.pools[i], blockNumber);
    cumulativeDeltaB = cumulativeDeltaB.plus(pool.deltaBeans);
  }

  beanHourly.instantaneousDeltaB = cumulativeDeltaB;
  beanDaily.instantaneousDeltaB = cumulativeDeltaB;
  beanHourly.save();
  beanDaily.save();
}

// Update Bean's TWA deltaB and price. Individual pools' values must be computed prior to calling this method.
export function updateBeanTwa(timestamp: BigInt, blockNumber: BigInt): void {
  let beanAddress = getBeanTokenAddress(blockNumber);
  let bean = loadBean(beanAddress);
  let beanHourly = loadOrCreateBeanHourlySnapshot(beanAddress, timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(beanAddress, timestamp);

  let twaDeltaB = ZERO_BI;
  let weightedTwaPrice = ZERO_BD;
  for (let i = 0; i < bean.pools.length; i++) {
    let poolHourly = loadOrCreatePoolHourlySnapshot(bean.pools[i], timestamp, blockNumber);
    twaDeltaB = twaDeltaB.plus(poolHourly.twaDeltaBeans);
    weightedTwaPrice = weightedTwaPrice.plus(poolHourly.twaPrice.times(poolHourly.liquidityUSD));
  }

  // Assumption is that total bean liquidity was already summed earlier in the same event's processing
  const twaPrice = weightedTwaPrice.div(bean.liquidityUSD != ZERO_BD ? bean.liquidityUSD : ONE_BD);

  beanHourly.twaDeltaB = twaDeltaB;
  beanHourly.twaPrice = twaPrice;
  beanDaily.twaDeltaB = twaDeltaB;
  beanDaily.twaPrice = twaPrice;
  beanHourly.save();
  beanDaily.save();
}
