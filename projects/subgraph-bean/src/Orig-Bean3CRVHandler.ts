import { TokenExchangeUnderlying } from '../generated/Bean3CRV/Bean3CRV'
import { CurvePrice } from '../generated/Bean3CRV/CurvePrice'
import { CURVE_PRICE } from './utils/Constants'
import { toDecimal, ZERO_BI } from './utils/Decimals'
import { loadBean, loadBeanDayData, loadBeanHourData, loadPool, loadPoolDayData, loadPoolHourData } from './utils/Orig-EntityLoaders'

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
    let curvePrice = CurvePrice.bind(CURVE_PRICE)

    let price = curvePrice.try_getCurve()

    let bean = loadBean()
    let beanHourly = loadBeanHourData(event.block.timestamp)
    let beanDaily = loadBeanDayData(event.block.timestamp)

    let beanVolume = event.params.sold_id == ZERO_BI ? toDecimal(event.params.tokens_sold) : toDecimal(event.params.tokens_bought)

    bean.price = toDecimal(price.price)
    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(beanVolume.times(toDecimal(price.price)))
    bean.save()

    beanHourly.price = toDecimal(price.price)
    beanHourly.totalVolume = beanHourly.totalVolume.plus(beanVolume)
    beanHourly.totalVolumeUSD = beanHourly.totalVolumeUSD.plus(beanVolume.times(toDecimal(price.price)))
    beanHourly.totalLiquidity = toDecimal(price.lpBdv)
    beanHourly.totalLiquidityUSD = toDecimal(price.lpUsd)
    beanHourly.save()

    beanDaily.price = toDecimal(price.price)
    beanDaily.totalVolume = beanDaily.totalVolume.plus(beanVolume)
    beanDaily.totalVolumeUSD = beanDaily.totalVolumeUSD.plus(beanVolume.times(toDecimal(price.price)))
    beanDaily.save()

    let pool = loadPool(event.address)
    let poolHourly = loadPoolHourData(event.block.timestamp, event.address)
    let poolDaily = loadPoolDayData(event.block.timestamp, event.address)


}


/*

export function handleSync(event: Sync): void {
    let pair = Pair.load(event.address.toHex())
    if (pair == null) pair = initializePair(event.address)

    pair.reserve0 = convertTokenToDecimal(event.params.reserve0, pair.decimals0)
    pair.reserve1 = convertTokenToDecimal(event.params.reserve1, pair.decimals1)

    pair.save()

    let beanPair = Pair.load(beanPairAddress.toHex())
    let usdcPair = Pair.load(usdcPairAddress.toHex())

    let bean = getBean(event.block.timestamp)
    if (bean.lastCross == ZERO_BI) bean.lastCross = event.block.timestamp

    if (beanPair != null && usdcPair != null) {

        let timestamp = event.block.timestamp.toI32()
        let dayId = timestamp / 86400
        let dayData = getDayData(dayId, bean!)

        let hourId = timestamp / 3600
        let hourData = getHourData(hourId, bean!)

        let price = beanPair.reserve0 / beanPair.reserve1 * usdcPair.reserve0 / usdcPair.reserve1
        if ((bean.price.le(ONE_BD) && price.ge(ONE_BD)) ||
            (bean.price.ge(ONE_BD) && price.le(ONE_BD))) {

            let timestamp = event.block.timestamp.toI32()

            createCross(bean.totalCrosses, timestamp, bean.lastCross.toI32(), dayData.id, hourData.id, price.ge(ONE_BD))
            // dayData = updateDayDataWithCross(bean!, dayData, timestamp)
            // hourData = updateHourDataWithCross(bean!, hourData!, timestamp)

            hourData.newCrosses = hourData.newCrosses + 1
            hourData.totalCrosses = hourData.totalCrosses + 1

            dayData.newCrosses = dayData.newCrosses + 1
            dayData.totalCrosses = dayData.totalCrosses + 1

            bean.totalCrosses = bean.totalCrosses + 1

            let timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
            hourData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
            dayData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
            bean.totalTimeSinceCross = bean.totalTimeSinceCross.plus(timeSinceLastCross)

            bean.lastCross = event.block.timestamp
        }
        bean.price = price
        bean.save()

        let priceId = event.block.timestamp.toString()
        let timestampPrice = Price.load(priceId)
        if (timestampPrice === null) {
            timestampPrice = new Price(priceId)
            timestampPrice.bean = bean.id
            timestampPrice.timestamp = event.block.timestamp
            timestampPrice.price = bean.price
        }
        timestampPrice.save()

        dayData.price = bean.price
        dayData.save()

        hourData.price = bean.price
        hourData.save()
    }

}
*/
