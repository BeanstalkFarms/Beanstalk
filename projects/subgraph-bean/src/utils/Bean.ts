import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Bean, BeanDailySnapshot, BeanHourlySnapshot } from "../../generated/schema"
import { dayFromTimestamp, hourFromTimestamp } from "./Dates"
import { ZERO_BD, ZERO_BI } from "./Decimals"

export function loadBean(token: string): Bean {
    let bean = Bean.load(token)
    if (bean == null) {
        bean = new Bean(token)
        bean.decimals = BigInt.fromI32(6)
        bean.supply = ZERO_BI
        bean.marketCap = ZERO_BD
        bean.volume = ZERO_BI
        bean.volumeUSD = ZERO_BD
        bean.liquidity = ZERO_BI
        bean.liquidityUSD = ZERO_BD
        bean.price = BigDecimal.fromString('1.072')
        bean.crosses = 0
        bean.lastCross = ZERO_BI
        bean.save()
    }
    return bean as Bean
}

export function loadOrCreateBeanHourlySnapshot(token: string, timestamp: BigInt): BeanHourlySnapshot {
    let hour = hourFromTimestamp(timestamp)
    let snapshot = BeanHourlySnapshot.load(hour)
    if (snapshot == null) {
        let bean = loadBean(token)
        snapshot = new BeanHourlySnapshot(hour)
        snapshot.bean = bean.id
        snapshot.totalSupply = ZERO_BI
        snapshot.marketCap = bean.marketCap
        snapshot.volume = bean.volume
        snapshot.volumeUSD = bean.volumeUSD
        snapshot.liquidity = bean.liquidity
        snapshot.liquidityUSD = bean.liquidityUSD
        snapshot.price = bean.price
        snapshot.crosses = bean.crosses
        snapshot.deltaBeans = ZERO_BI
        snapshot.deltaVolume = ZERO_BI
        snapshot.deltaVolumeUSD = ZERO_BD
        snapshot.deltaLiquidity = ZERO_BI
        snapshot.deltaLiquidityUSD = ZERO_BD
        snapshot.deltaCrosses = 0
        snapshot.season = 6074
        snapshot.timestamp = timestamp
        snapshot.blockNumber = ZERO_BI
        snapshot.save()
    }
    return snapshot as BeanHourlySnapshot
}

export function loadOrCreateBeanDailySnapshot(token: string, timestamp: BigInt): BeanDailySnapshot {
    let day = dayFromTimestamp(timestamp)
    let snapshot = BeanDailySnapshot.load(day)
    if (snapshot == null) {
        let bean = loadBean(token)
        snapshot = new BeanDailySnapshot(day)
        snapshot.bean = bean.id
        snapshot.totalSupply = ZERO_BI
        snapshot.marketCap = bean.marketCap
        snapshot.volume = bean.volume
        snapshot.volumeUSD = bean.volumeUSD
        snapshot.liquidity = bean.liquidity
        snapshot.liquidityUSD = bean.liquidityUSD
        snapshot.price = bean.price
        snapshot.crosses = bean.crosses
        snapshot.deltaBeans = ZERO_BI
        snapshot.deltaVolume = ZERO_BI
        snapshot.deltaVolumeUSD = ZERO_BD
        snapshot.deltaLiquidity = ZERO_BI
        snapshot.deltaLiquidityUSD = ZERO_BD
        snapshot.deltaCrosses = 0
        snapshot.season = 6074
        snapshot.timestamp = timestamp
        snapshot.blockNumber = ZERO_BI
        snapshot.save()
    }
    return snapshot as BeanDailySnapshot
}

export function updateBeanValues(
    token: string,
    timestamp: BigInt,
    newPrice: BigDecimal,
    deltaSupply: BigInt,
    deltaVolume: BigInt,
    deltaVolumeUSD: BigDecimal,
    deltaLiquidity: BigInt,
    deltaLiquidityUSD: BigDecimal
): void {
    let bean = loadBean(token)
    let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp)
    let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp)

    bean.price = newPrice
    bean.supply = bean.supply.plus(deltaSupply)
    bean.volume = bean.volume.plus(deltaVolume)
    bean.volumeUSD = bean.volumeUSD.plus(deltaVolumeUSD)
    bean.liquidity = bean.liquidity.plus(deltaLiquidity)
    bean.liquidityUSD = bean.liquidityUSD.plus(deltaLiquidityUSD)
    bean.save()

    beanHourly.volume = bean.volume
    beanHourly.volumeUSD = bean.volumeUSD
    beanHourly.liquidityUSD = bean.liquidityUSD
    beanHourly.price = bean.price
    beanHourly.deltaVolume = beanHourly.deltaVolume.plus(deltaVolume)
    beanHourly.deltaVolumeUSD = beanHourly.deltaVolumeUSD.plus(deltaVolumeUSD)
    beanHourly.deltaLiquidityUSD = beanHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.volume = bean.volume
    beanDaily.volumeUSD = bean.volumeUSD
    beanDaily.liquidityUSD = bean.liquidityUSD
    beanDaily.price = bean.price
    beanDaily.deltaVolume = beanDaily.deltaVolume.plus(deltaVolume)
    beanDaily.deltaVolumeUSD = beanDaily.deltaVolumeUSD.plus(deltaVolumeUSD)
    beanDaily.deltaLiquidityUSD = beanDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()
}

export function updateBeanSeason(token: string, timestamp: BigInt, season: i32): void {
    let bean = loadBean(token)
    let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp)
    let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp)

    beanHourly.season = season
    beanHourly.save()

    beanDaily.season = season
    beanDaily.save()
}
