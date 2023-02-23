import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Season } from "../../generated/schema";
import { loadBeanstalk } from "./Beanstalk";
import { ONE_BI, ZERO_BD, ZERO_BI } from "./Decimals";

export function loadSeason(diamondAddress: Address, id: BigInt): Season {
  let season = Season.load(id.toString());
  if (season == null) {
    season = new Season(id.toString());
    season.beanstalk = diamondAddress.toHexString();
    season.season = id.toI32();
    season.createdAt = ZERO_BI;
    season.price = ZERO_BD;
    season.beans = ZERO_BI;
    season.marketCap = ZERO_BD;
    season.deltaB = ZERO_BI;
    season.deltaBeans = ZERO_BI;
    season.rewardBeans = ZERO_BI;
    season.incentiveBeans = ZERO_BI;
    season.harvestableIndex = ZERO_BI;
    season.save();
    if (id > ZERO_BI) {
      let lastSeason = loadSeason(diamondAddress, id.minus(ONE_BI));
      season.beans = lastSeason.beans;
      season.harvestableIndex = lastSeason.harvestableIndex;
      season.save();
    }

    // Update beanstalk season
    let beanstalk = loadBeanstalk(diamondAddress);
    beanstalk.lastSeason = season.season;
    beanstalk.save();
  }
  return season;
}
