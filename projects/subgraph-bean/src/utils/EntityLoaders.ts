import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Bean, BeanDailySnapshot, BeanHourlySnapshot, Cross } from "../../generated/schema";
import { BEAN_ERC20_V2 } from "./Constants";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadBean(): Bean {
    let bean = Bean.load(BEAN_ERC20_V2.toHexString())
    if (bean == null) {
        bean = new Bean(BEAN_ERC20_V2.toHexString())
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

export function loadBeanHourlySnapshot(timestamp: BigInt): BeanHourlySnapshot {
    let hour = hourFromTimestamp(timestamp)
    let snapshot = BeanHourlySnapshot.load(hour)
    if (snapshot == null) {
        let bean = loadBean()
        snapshot = new BeanHourlySnapshot(hour)
        snapshot.bean = BEAN_ERC20_V2.toHexString()
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

export function loadBeanDailySnapshot(timestamp: BigInt): BeanDailySnapshot {
    let day = dayFromTimestamp(timestamp)
    let snapshot = BeanDailySnapshot.load(day)
    if (snapshot == null) {
        let bean = loadBean()
        snapshot = new BeanDailySnapshot(day)
        snapshot.bean = BEAN_ERC20_V2.toHexString()
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

export function loadCross(id: i32, timestamp: BigInt): Cross {
    let cross = Cross.load(id.toString())
    if (cross == null) {
        let hour = hourFromTimestamp(timestamp)
        let day = dayFromTimestamp(timestamp)
        cross = new Cross(id.toString())
        //cross.pool == '1'
        cross.price = ZERO_BD
        cross.timestamp = timestamp
        cross.timeSinceLastCross = ZERO_BI
        cross.above = false
        cross.hourlySnapshot = hour
        cross.dailySnapshot = day
        //cross.poolHourlySnapshot = '1'
        //cross.poolDailySnapshot = '1'
        cross.save()
    }
    return cross as Cross
}
