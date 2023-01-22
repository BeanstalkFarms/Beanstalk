import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityImbalance, RemoveLiquidityOne, TokenExchange, TokenExchangeUnderlying } from "../generated/Bean3CRV/Bean3CRV";
import { CurvePrice } from "../generated/Bean3CRV/CurvePrice";
import { CURVE_PRICE } from "./utils/Constants";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "./utils/Decimals";
import { loadBean, loadBeanDailySnapshot, loadBeanHourlySnapshot, loadCross } from "./utils/EntityLoaders";

export function handleTokenExchange(event: TokenExchange): void {
    handleSwap(event.params.sold_id, event.params.tokens_sold, event.params.bought_id, event.params.tokens_bought, event.block.timestamp)
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
    handleSwap(event.params.sold_id, event.params.tokens_sold, event.params.bought_id, event.params.tokens_bought, event.block.timestamp)
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
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.liquidityUSD)

    let volumeUSD = deltaLiquidityUSD < ZERO_BD ? deltaLiquidityUSD.div(BigDecimal.fromString('2')).times(BigDecimal.fromString('-1')) : deltaLiquidityUSD.div(BigDecimal.fromString('2'))
    let beanVolume = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString('1000000')).truncate(0).toString())

    if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
        volumeUSD = ZERO_BD
        beanVolume = ZERO_BI
    }
    bean.volume = bean.volume.plus(beanVolume)
    bean.volumeUSD = bean.volumeUSD.plus(volumeUSD)
    bean.liquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.save()

    beanHourly.volume = bean.volume
    beanHourly.volumeUSD = bean.volumeUSD
    beanHourly.liquidityUSD = bean.liquidityUSD
    beanHourly.price = bean.price
    beanHourly.deltaLiquidityUSD = beanHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.deltaVolume = beanHourly.deltaVolume.plus(beanVolume)
    beanHourly.deltaVolumeUSD = beanHourly.deltaVolumeUSD.plus(volumeUSD)
    beanHourly.save()

    beanHourly.volume = bean.volume
    beanHourly.volumeUSD = bean.volumeUSD
    beanDaily.liquidityUSD = bean.liquidityUSD
    beanDaily.price = bean.price
    beanDaily.deltaLiquidityUSD = beanDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.deltaVolume = beanDaily.deltaVolume.plus(beanVolume)
    beanDaily.deltaVolumeUSD = beanDaily.deltaVolumeUSD.plus(volumeUSD)
    beanDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadCross(bean.crosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = false
        cross.save()

        bean.lastCross = timestamp
        bean.crosses += 1
        bean.save()

        beanHourly.crosses += 1
        beanHourly.deltaCrosses += 1
        beanHourly.save()

        beanDaily.crosses += 1
        beanDaily.deltaCrosses += 1
        beanDaily.save()
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        let cross = loadCross(bean.crosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = true
        cross.save()

        bean.lastCross = timestamp
        bean.crosses += 1
        bean.save()

        beanHourly.crosses += 1
        beanHourly.deltaCrosses += 1
        beanHourly.save()

        beanDaily.crosses += 1
        beanDaily.deltaCrosses += 1
        beanDaily.save()
    }
}

function handleSwap(
    sold_id: BigInt,
    tokens_sold: BigInt,
    bought_id: BigInt,
    tokens_bought: BigInt,
    timestamp: BigInt
): void {
    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(timestamp)
    let beanDaily = loadBeanDailySnapshot(timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let beanVolume = ZERO_BI

    if (sold_id == ZERO_BI) {
        beanVolume = tokens_sold
    } else if (bought_id == ZERO_BI) {
        beanVolume = tokens_bought
    }
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.liquidityUSD)

    bean.volume = bean.volume.plus(beanVolume)
    bean.volumeUSD = bean.volumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    bean.liquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.save()

    beanHourly.volume = bean.volume
    beanHourly.volumeUSD = bean.volumeUSD
    beanHourly.liquidityUSD = bean.liquidityUSD
    beanHourly.price = bean.price
    beanHourly.deltaVolume = beanHourly.deltaVolume.plus(beanVolume)
    beanHourly.deltaVolumeUSD = beanHourly.deltaVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanHourly.deltaLiquidityUSD = beanHourly.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.volume = bean.volume
    beanDaily.volumeUSD = bean.volumeUSD
    beanDaily.liquidityUSD = bean.liquidityUSD
    beanDaily.price = bean.price
    beanDaily.deltaVolume = beanDaily.deltaVolume.plus(beanVolume)
    beanDaily.deltaVolumeUSD = beanDaily.deltaVolumeUSD.plus(toDecimal(beanVolume).times(newPrice))
    beanDaily.deltaLiquidityUSD = beanDaily.deltaLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadCross(bean.crosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = false
        cross.save()

        bean.lastCross = timestamp
        bean.crosses += 1
        bean.save()

        beanHourly.crosses += 1
        beanHourly.deltaCrosses += 1
        beanHourly.save()

        beanDaily.crosses += 1
        beanDaily.deltaCrosses += 1
        beanDaily.save()
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        let cross = loadCross(bean.crosses + 1, timestamp)
        cross.price = newPrice
        cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
        cross.above = true
        cross.save()

        bean.lastCross = timestamp
        bean.crosses += 1
        bean.save()

        beanHourly.crosses += 1
        beanHourly.deltaCrosses += 1
        beanHourly.save()

        beanDaily.crosses += 1
        beanDaily.deltaCrosses += 1
        beanDaily.save()
    }
}
