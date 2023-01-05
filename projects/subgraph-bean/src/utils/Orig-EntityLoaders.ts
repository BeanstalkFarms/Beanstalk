import { BEAN_ERC20 } from "./Constants";
import { Bean, BeanDayData, BeanHourData, Pair, Pool, PoolDayData, PoolHourData, Price, Supply } from "../../generated/schema"
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { ZERO_BD, ZERO_BI } from "./Decimals"
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";

export function loadBean(): Bean {
    let bean = Bean.load(BEAN_ERC20.toHexString())
    if (bean == null) {
        bean = new Bean(BEAN_ERC20.toHexString())
        bean.decimals = BigInt.fromI32(6)
        bean.totalSupply = ZERO_BD
        bean.totalSupplyUSD = ZERO_BD
        bean.totalVolume = ZERO_BD
        bean.totalVolumeUSD = ZERO_BD
        bean.totalLiquidity = ZERO_BD
        bean.totalLiquidityUSD = ZERO_BD
        bean.averagePrice = ZERO_BD
        bean.price = ZERO_BD
        bean.save()
    }
    return bean as Bean
}

export function loadPool(poolAddress: Address): Pool {
    let pool = Pool.load(poolAddress.toHexString())
    if (pool == null) {
        pool = new Pool(poolAddress.toHexString())
        pool.bean = BEAN_ERC20.toHexString()
        pool.liquidity = ZERO_BD
        pool.liquidityUSD = ZERO_BD
        pool.volumeBean = ZERO_BD
        pool.volumeUSD = ZERO_BD
        pool.utilisation = ZERO_BD
        pool.delta = ZERO_BD
        pool.save()
    }
    return pool as Pool
}

export function loadSupply(timestamp: BigInt): Supply {
    let supply = Supply.load(timestamp.toString())
    if (supply == null) {
        supply = new Supply(timestamp.toString())
        supply.bean = BEAN_ERC20.toHexString()
        supply.timestamp = timestamp
        supply.totalSupply = ZERO_BD
        supply.totalSupplyUSD = ZERO_BD
        supply.save()
    }
    return supply as Supply
}

export function loadPrice(timestamp: BigInt, pool: Address): Price {
    let price = Price.load(timestamp.toString())
    if (price == null) {
        price = new Price(timestamp.toString())
        price.pool = pool.toHexString()
        price.timestamp = timestamp
        price.price = ZERO_BD
        price.invariant = ZERO_BD
        price.tokensupply = ZERO_BD
        price.amount1 = ZERO_BD
        price.lastCross = ZERO_BI
        price.totalCrosses = 0
        price.totalTimeSinceCross = ZERO_BI
        price.startTime = 0
        price.save()
    }
    return price as Price
}

export function loadBeanHourData(timestamp: BigInt): BeanHourData {
    let hour = hourFromTimestamp(timestamp)
    let data = BeanHourData.load(hour.toString())
    if (data == null) {
        data = new BeanHourData(hour.toString())
        data.bean = BEAN_ERC20.toHexString()
        data.price = ZERO_BD
        data.hourTimestamp = BigInt.fromString(hour).toI32()
        data.totalSupply = ZERO_BD
        data.totalSupplyUSD = ZERO_BD
        data.totalVolume = ZERO_BD
        data.totalVolumeUSD = ZERO_BD
        data.totalLiquidity = ZERO_BD
        data.totalLiquidityUSD = ZERO_BD
        data.averagePrice = ZERO_BD
        data.save()
    }
    return data as BeanHourData
}

export function loadBeanDayData(timestamp: BigInt): BeanDayData {
    let day = dayFromTimestamp(timestamp)
    let data = BeanDayData.load(day.toString())
    if (data == null) {
        data = new BeanDayData(day.toString())
        data.bean = BEAN_ERC20.toHexString()
        data.price = ZERO_BD
        data.dayTimestamp = BigInt.fromString(day).toI32()
        data.totalSupply = ZERO_BD
        data.totalSupplyUSD = ZERO_BD
        data.totalVolume = ZERO_BD
        data.totalVolumeUSD = ZERO_BD
        data.totalLiquidity = ZERO_BD
        data.totalLiquidityUSD = ZERO_BD
        data.averagePrice = ZERO_BD
        data.save()
    }
    return data as BeanDayData
}

export function loadPoolHourData(timestamp: BigInt, pool: Address): PoolHourData {
    let hour = hourFromTimestamp(timestamp)
    let id = pool.toHexString() + '-' + hour.toString()
    let data = PoolHourData.load(id)
    if (data == null) {
        data = new PoolHourData(id)
        data.pool = pool.toHexString()
        data.hourTimestamp = BigInt.fromString(hour).toI32()
        data.price = ZERO_BD
        data.reserve0 = ZERO_BD
        data.reserve1 = ZERO_BD
        data.liquidity = ZERO_BD
        data.liquidityUSD = ZERO_BD
        data.volumeBean = ZERO_BD
        data.volumeUSD = ZERO_BD
        data.utilisation = ZERO_BD
        data.delta = ZERO_BD
        data.newCrosses = 0
        data.totalCrosses = 0
        data.totalTimeSinceCross = ZERO_BI
        data.save()
    }
    return data as PoolHourData
}

export function loadPoolDayData(timestamp: BigInt, pool: Address): PoolDayData {
    let day = dayFromTimestamp(timestamp)
    let id = pool.toHexString() + '-' + day.toString()
    let data = PoolDayData.load(id)
    if (data == null) {
        data = new PoolDayData(id)
        data.pool = pool.toHexString()
        data.dayTimestamp = BigInt.fromString(day).toI32()
        data.price = ZERO_BD
        data.reserve0 = ZERO_BD
        data.reserve1 = ZERO_BD
        data.liquidity = ZERO_BD
        data.liquidityUSD = ZERO_BD
        data.volumeBean = ZERO_BD
        data.volumeUSD = ZERO_BD
        data.utilisation = ZERO_BD
        data.delta = ZERO_BD
        data.newCrosses = 0
        data.totalCrosses = 0
        data.totalTimeSinceCross = ZERO_BI
        data.save()
    }
    return data as PoolDayData
}

export function loadPair(pairAddress: Address): Pair {
    let pair = Pair.load(pairAddress.toHexString())
    if (pair == null) {
        pair = new Pair(pairAddress.toHexString())
        pair.pool = pairAddress.toHexString()
        pair.decimals0 = ZERO_BI
        pair.decimals1 = ZERO_BI
        pair.reserve0 = ZERO_BD
        pair.reserve1 = ZERO_BD
        pair.save()
    }
    return pair as Pair
}
