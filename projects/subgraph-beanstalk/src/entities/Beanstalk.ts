import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../../generated/schema";
import { Farmer } from "../../generated/schema";
import { Season } from "../../generated/schema";
import { BI_MAX, ONE_BI, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getProtocolFertilizer, getProtocolToken } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "../utils/constants/Version";
import { loadField } from "./Field";

export function loadBeanstalk(): Beanstalk {
  let beanstalk = Beanstalk.load("beanstalk");
  if (beanstalk == null) {
    beanstalk = new Beanstalk("beanstalk");
    // Pre-replant token currently would not be set
    beanstalk.token = getProtocolToken(v(), BI_MAX);
    beanstalk.fertilizer1155 = getProtocolFertilizer(v());
    beanstalk.lastSeason = 1;
    beanstalk.activeFarmers = [];
    beanstalk.farmersToUpdate = [];
    beanstalk.save();
  }
  return beanstalk as Beanstalk;
}

export function loadFarmer(account: Address): Farmer {
  let farmer = Farmer.load(account);
  if (farmer == null) {
    farmer = new Farmer(account);
    farmer.save();
  }
  return farmer;
}

export function loadSeason(id: BigInt): Season {
  let season = Season.load(id.toString());
  if (season == null) {
    season = new Season(id.toString());
    season.beanstalk = "beanstalk";
    season.season = id.toI32();
    season.sunriseBlock = ZERO_BI;
    season.createdAt = ZERO_BI;
    season.price = ZERO_BD;
    season.beans = ZERO_BI;
    season.marketCap = ZERO_BD;
    season.deltaB = ZERO_BI;
    season.deltaBeans = ZERO_BI;
    season.rewardBeans = ZERO_BI;
    season.incentiveBeans = ZERO_BI;

    let lastSeason = Season.load(id.minus(ONE_BI).toString());
    if (lastSeason != null) {
      season.beans = lastSeason.beans;
    }
    season.save();

    // Update beanstalk season
    let beanstalk = loadBeanstalk();
    beanstalk.lastSeason = season.season;
    beanstalk.save();
  }
  return season;
}

export function getCurrentSeason(): i32 {
  return loadBeanstalk().lastSeason;
}

// Returns the number of reward beans minted for the requested season
export function getRewardMinted(season: i32): BigInt {
  const snapshot = Season.load(season.toString());
  if (snapshot == null) {
    return ZERO_BI;
  }
  return snapshot.rewardBeans;
}

export function getHarvestableIndex(): BigInt {
  let field = loadField(v().protocolAddress);
  return field.harvestableIndex;
}
