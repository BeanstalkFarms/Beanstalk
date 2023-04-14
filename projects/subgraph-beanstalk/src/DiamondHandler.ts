import { DiamondCut } from "../generated/Diamond/Beanstalk";
import { Beanstalk } from "../generated/schema";
import { loadBeanstalk } from "./utils/Beanstalk";
import { ZERO_BI } from "./utils/Decimals";

export function handleDiamondCut(event: DiamondCut): void {
    let beanstalk = loadBeanstalk(event.address)

    beanstalk.lastUpgrade = event.block.timestamp
    beanstalk.save()
}
