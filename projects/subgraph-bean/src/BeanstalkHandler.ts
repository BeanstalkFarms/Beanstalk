import { Sunrise } from '../generated/Beanstalk/Beanstalk'
import { updateBeanSeason } from './utils/Bean'
import { BEAN_ERC20_V2 } from './utils/Constants'

export function handleSunrise(event: Sunrise): void {
    // Update the season for hourly and daily liquidity metrics

    updateBeanSeason(BEAN_ERC20_V2.toHexString(), event.block.timestamp, event.params.season.toI32())
}
