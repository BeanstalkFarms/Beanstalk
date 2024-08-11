import { DiamondCut } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { loadBeanstalk } from "../entities/Beanstalk";

export function handleDiamondCut(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);
  beanstalk.lastUpgrade = event.block.timestamp;
  beanstalk.save();
}
