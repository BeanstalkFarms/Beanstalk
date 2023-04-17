import { Address } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../../generated/schema";
import { ZERO_BI } from "./Decimals";

export function loadBeanstalk(protocol: Address): Beanstalk {
    let beanstalk = Beanstalk.load(protocol.toHexString())
    if (beanstalk == null) {
        beanstalk = new Beanstalk(protocol.toHexString())
        beanstalk.name = 'Beanstalk'
        beanstalk.slug = 'beanstalk'
        beanstalk.schemaVersion = '2.0.0'
        beanstalk.subgraphVersion = '2.0.0'
        beanstalk.methodologyVersion = '2.0.0'
        beanstalk.lastUpgrade = ZERO_BI
        beanstalk.lastSeason = 1
        beanstalk.activeFarmers = []
        beanstalk.farmersToUpdate = []
        beanstalk.save()
    }
    return beanstalk as Beanstalk
}
