import { DiamondCut } from "../generated/Diamond/Beanstalk";
import { loadBeanstalk } from "./utils/Beanstalk";

export function handleDiamondCut(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  beanstalk.lastUpgrade = event.block.timestamp;
  beanstalk.save();
}
