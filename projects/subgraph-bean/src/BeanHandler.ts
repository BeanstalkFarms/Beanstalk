import { Transfer } from "../generated/Bean/Bean";

export function handleTransfer(event: Transfer): void {
    /*
        if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    
            let beanstalk = loadBeanstalk(BEANSTALK)
            let season = loadSeason(BEANSTALK, BigInt.fromI32(beanstalk.lastSeason))
    
            log.debug('\nBeanSupply: ============\nBeanSupply: Starting Supply - {}\n', [toDecimal(season.beans).toString()])
    
            if (event.params.from == ADDRESS_ZERO) {
                season.deltaBeans = season.deltaBeans.plus(event.params.value)
                season.beans = season.beans.plus(event.params.value)
                log.debug('\nBeanSupply: Beans Minted - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n', [toDecimal(event.params.value).toString(), season.season.toString(), toDecimal(season.beans).toString()])
            } else {
                season.deltaBeans = season.deltaBeans.minus(event.params.value)
                season.beans = season.beans.minus(event.params.value)
                log.debug('\nBeanSupply: Beans Burned - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n', [toDecimal(event.params.value).toString(), season.season.toString(), toDecimal(season.beans).toString()])
            }
            season.save()
        }*/
}
