import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../../generated/schema";
import { Farmer } from "../../generated/schema";
import { Season } from "../../generated/schema";
import { BI_MAX, ONE_BI, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { getProtocolFertilizer, getProtocolToken } from "../utils/Constants";

export function loadBeanstalk(protocol: Address): Beanstalk {
  let beanstalk = Beanstalk.load(protocol.toHexString());
  if (beanstalk == null) {
    beanstalk = new Beanstalk(protocol.toHexString());
    beanstalk.name = "Beanstalk";
    // Pre-replant token currently would not be set
    beanstalk.token = getProtocolToken(protocol).toHexString();
    const fert = getProtocolFertilizer(protocol);
    if (fert !== null) {
      beanstalk.fertilizer1155 = fert.toHexString();
    }
    beanstalk.lastSeason = 1;
    beanstalk.activeFarmers = [];
    beanstalk.farmersToUpdate = [];
    beanstalk.save();
  }
  return beanstalk as Beanstalk;
}

export function loadFarmer(account: Address): Farmer {
  let farmer = Farmer.load(account.toHexString());
  if (farmer == null) {
    farmer = new Farmer(account.toHexString());
    farmer.save();
  }
  return farmer;
}

export function loadSeason(diamondAddress: Address, id: BigInt): Season {
  let season = Season.load(id.toString());
  if (season == null) {
    season = new Season(id.toString());
    season.beanstalk = diamondAddress.toHexString();
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

export function getBeanstalkToken(protocol: Address): Address {
  let beanstalkEntity = loadBeanstalk(protocol);
  return Address.fromString(beanstalkEntity.token);
}

export function getCurrentSeason(protocol: Address): i32 {
  let beanstalkEntity = loadBeanstalk(protocol);
  return beanstalkEntity.lastSeason;
}

// Returns the number of reward beans minted for the requested season
export function getRewardMinted(season: i32): BigInt {
  const snapshot = Season.load(season.toString());
  if (snapshot == null) {
    return ZERO_BI;
  }
  return snapshot.rewardBeans;
}

export function getHarvestableIndex(protocol: Address): BigInt {
  let bs = loadBeanstalk(protocol);
  let season = loadSeason(protocol, BigInt.fromI32(bs.lastSeason));
  return season.harvestableIndex;
}
