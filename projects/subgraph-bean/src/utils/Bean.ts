import { BigDecimal, BigInt, ethereum, Address } from "@graphprotocol/graph-ts";
import { Pool } from "../../generated/schema";
import {
  BEAN_ERC20_V1,
  BEAN_ERC20,
  BEAN_WETH_V1,
  BEAN_3CRV_V1,
  BEAN_LUSD_V1,
  NEW_BEAN_TOKEN_BLOCK
} from "../../../subgraph-core/utils/Constants";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { checkBeanCross } from "./Cross";
import { BeanstalkPrice_try_price, BeanstalkPriceResult } from "./price/BeanstalkPrice";
import { calcLockedBeans } from "./LockedBeans";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "../entities/Bean";
import { loadOrCreatePool, loadOrCreatePoolHourlySnapshot } from "../entities/Pool";
import { externalUpdatePoolPrice as univ2_externalUpdatePoolPrice } from "../handlers/legacy/LegacyUniswapV2Handler";

export function updateBeanValues(
  token: string,
  newPrice: BigDecimal | null,
  deltaSupply: BigInt,
  deltaVolume: BigInt,
  deltaVolumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal,
  block: ethereum.Block
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

  let beanHourly = loadOrCreateBeanHourlySnapshot(token, block.timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, block.timestamp);

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
  return blockNumber < NEW_BEAN_TOKEN_BLOCK ? BEAN_ERC20_V1.toHexString() : BEAN_ERC20.toHexString();
}

export function updateBeanSupplyPegPercent(blockNumber: BigInt): void {
  if (blockNumber < NEW_BEAN_TOKEN_BLOCK) {
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
  block: ethereum.Block,
  priceContractResult: BeanstalkPriceResult | null = null
): void {
  let pool = loadOrCreatePool(poolAddress, block.number);
  let bean = loadBean(pool.bean);
  // Verify the pool is still whitelisted
  if (bean.pools.indexOf(poolAddress) >= 0) {
    let oldBeanPrice = bean.price;
    let beanPrice = poolPrice;

    // Get overall price from price contract if a result was not already provided
    if (bean.id == BEAN_ERC20_V1.toHexString()) {
      univ2_externalUpdatePoolPrice(BEAN_WETH_V1, block);
      beanPrice = calcLiquidityWeightedBeanPrice(bean.id);
    } else {
      if (priceContractResult === null) {
        priceContractResult = BeanstalkPrice_try_price(Address.fromString(bean.id), block.number);
      }
      if (!priceContractResult.reverted) {
        beanPrice = toDecimal(priceContractResult.value.price);
      }
    }

    updateBeanSupplyPegPercent(block.number);
    updateBeanValues(bean.id, beanPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD, block);
    checkBeanCross(bean.id, oldBeanPrice, beanPrice, block);
  }
}

export function updateInstDeltaB(token: string, block: ethereum.Block): void {
  let bean = loadBean(token);
  let beanHourly = loadOrCreateBeanHourlySnapshot(token, block.timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(token, block.timestamp);

  let cumulativeDeltaB = ZERO_BI;
  for (let i = 0; i < bean.pools.length; i++) {
    let pool = loadOrCreatePool(bean.pools[i], block.number);
    cumulativeDeltaB = cumulativeDeltaB.plus(pool.deltaBeans);
  }

  beanHourly.instantaneousDeltaB = cumulativeDeltaB;
  beanDaily.instantaneousDeltaB = cumulativeDeltaB;
  beanHourly.save();
  beanDaily.save();
}

// Update Bean's TWA deltaB and price. Individual pools' values must be computed prior to calling this method.
export function updateBeanTwa(block: ethereum.Block): void {
  let beanAddress = getBeanTokenAddress(block.number);
  let bean = loadBean(beanAddress);
  let beanHourly = loadOrCreateBeanHourlySnapshot(beanAddress, block.timestamp, bean.lastSeason);
  let beanDaily = loadOrCreateBeanDailySnapshot(beanAddress, block.timestamp);

  let twaDeltaB = ZERO_BI;
  let weightedTwaPrice = ZERO_BD;
  for (let i = 0; i < bean.pools.length; i++) {
    let poolHourly = loadOrCreatePoolHourlySnapshot(bean.pools[i], block);
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
