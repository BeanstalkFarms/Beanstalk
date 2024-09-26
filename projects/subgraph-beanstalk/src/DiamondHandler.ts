import { DiamondCut } from "../generated/Beanstalk-ABIs/PreReplant";
import { loadBeanstalk } from "./utils/Beanstalk";

export function handleDiamondCut(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  beanstalk.lastUpgrade = event.block.timestamp;
  beanstalk.save();
}
