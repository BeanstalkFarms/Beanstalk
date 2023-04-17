import { loadBeanDailySnapshot, loadBeanHourlySnapshot } from "./utils/EntityLoaders";
import { Sunrise } from '../generated/Beanstalk/Beanstalk'

export function handleSunrise(event: Sunrise): void {
    // Update the season for hourly and daily liquidity metrics
    let hourly = loadBeanHourlySnapshot(event.block.timestamp)
    let daily = loadBeanDailySnapshot(event.block.timestamp)

    hourly.season = event.params.season.toI32()
    hourly.timestamp = event.block.timestamp
    hourly.blockNumber = event.block.number
    hourly.save()

    daily.season = event.params.season.toI32()
    daily.timestamp = event.block.timestamp
    daily.blockNumber = event.block.number
    daily.save()
}
