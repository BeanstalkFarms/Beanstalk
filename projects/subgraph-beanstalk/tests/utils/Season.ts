import { loadBeanstalk } from "../../src/entities/Beanstalk";

export function setSeason(season: u32): void {
  let beanstalk = loadBeanstalk();
  beanstalk.lastSeason = season;
  beanstalk.save();
}
