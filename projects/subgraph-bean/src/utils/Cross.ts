import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Cross } from "../../generated/schema"
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "./Bean"
import { dayFromTimestamp, hourFromTimestamp } from "./Dates"
import { ONE_BD, ZERO_BD, ZERO_BI } from "./Decimals"

export function loadOrCreateCross(id: i32, pool: string, timestamp: BigInt): Cross {
    let cross = Cross.load(id.toString())
    if (cross == null) {
        let hour = hourFromTimestamp(timestamp)
        let day = dayFromTimestamp(timestamp)
        cross = new Cross(id.toString())
        cross.pool = pool
        cross.price = ZERO_BD
        cross.timestamp = timestamp
        cross.timeSinceLastCross = ZERO_BI
        cross.above = false
        cross.hourlySnapshot = hour
        cross.dailySnapshot = day
        cross.poolHourlySnapshot = pool + '-' + hour
        cross.poolDailySnapshot = pool + '-' + day
        cross.save()
    }
    return cross as Cross
}

export function checkCrossAndUpdate(token: string, pool: string, timestamp: BigInt, oldPrice: BigDecimal, newPrice: BigDecimal): void {

    let bean = loadBean(token)
    let beanHourly = loadOrCreateBeanHourlySnapshot(token, timestamp)
    let beanDaily = loadOrCreateBeanDailySnapshot(token, timestamp)

    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        let cross = loadOrCreateCross(bean.crosses + 1, pool, timestamp)
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
        let cross = loadOrCreateCross(bean.crosses + 1, pool, timestamp)
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
