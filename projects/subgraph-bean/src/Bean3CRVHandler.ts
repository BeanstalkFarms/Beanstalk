import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityImbalance, RemoveLiquidityOne, TokenExchange, TokenExchangeUnderlying } from "../generated/Bean3CRV/Bean3CRV";
import { CurvePrice } from "../generated/Bean3CRV/CurvePrice";
import { CURVE_PRICE } from "./utils/Constants";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "./utils/Decimals";
import { loadBean, loadBeanDailySnapshot, loadBeanHourlySnapshot, loadCross } from "./utils/EntityLoaders";

export function handleTokenExchange(event: TokenExchange): void {
    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(event.block.timestamp)
    let beanDaily = loadBeanDailySnapshot(event.block.timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let beanVolume = ZERO_BI

    if (event.params.sold_id == ZERO_BI) {
        beanVolume = event.params.tokens_sold
    } else if (event.params.bought_id == ZERO_BI) {
        beanVolume = event.params.tokens_bought
    }
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)

    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    //bean.totalLiquidity = curve.value.lpBdv
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.totalVolume = bean.totalVolume
    beanDaily.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, event.block.timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        cross.above = false
        cross.save()

        bean.lastCross = event.block.timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, event.block.timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        cross.above = true
        cross.save()

        bean.lastCross = event.block.timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {

    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(event.block.timestamp)
    let beanDaily = loadBeanDailySnapshot(event.block.timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let beanVolume = ZERO_BI

    if (event.params.sold_id == ZERO_BI) {
        beanVolume = event.params.tokens_sold
    } else if (event.params.bought_id == ZERO_BI) {
        beanVolume = event.params.tokens_bought
    }
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)

    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    //bean.totalLiquidity = curve.value.lpBdv
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.totalVolume = bean.totalVolume
    beanDaily.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, event.block.timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        cross.above = false
        cross.save()

        bean.lastCross = event.block.timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, event.block.timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        cross.above = true
        cross.save()

        bean.lastCross = event.block.timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }
}

export function handleAddLiquidity(event: AddLiquidity): void {
    handleLiquidityChange(event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1])
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
    handleLiquidityChange(event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1])
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
    handleLiquidityChange(event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1])
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
    handleLiquidityChange(event.block.timestamp, event.params.token_amount, ZERO_BI)
}

function handleLiquidityChange(timestamp: BigInt, token0Amount: BigInt, token1Amount: BigInt): void {
    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(timestamp)
    let beanDaily = loadBeanDailySnapshot(timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)

    let volumeUSD = deltaLiquidityUSD < ZERO_BD ? deltaLiquidityUSD.div(BigDecimal.fromString('2')).times(BigDecimal.fromString('-1')) : deltaLiquidityUSD.div(BigDecimal.fromString('2'))
    let beanVolume = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString('1000000')).truncate(0).toString())

    if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
        volumeUSD = ZERO_BD
        beanVolume = ZERO_BI
    }
    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(volumeUSD)
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(volumeUSD)
    beanHourly.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(volumeUSD)
    beanDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = false
        cross.save()

        bean.lastCross = timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        let cross = loadCross(bean.totalCrosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = true
        cross.save()

        bean.lastCross = timestamp
        bean.totalCrosses += 1
        bean.save()

        beanHourly.totalCrosses += 1
        beanHourly.hourlyCrosses += 1
        beanHourly.save()

        beanDaily.totalCrosses += 1
        beanDaily.dailyCrosses += 1
        beanDaily.save()
    }
}
