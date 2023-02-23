import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Silo, SiloHourlySnapshot, SiloDailySnapshot } from "../../generated/schema";
import { BEANSTALK } from "./Constants";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadSilo(account: Address): Silo {
  let silo = Silo.load(account.toHexString());
  if (silo == null) {
    silo = new Silo(account.toHexString());
    silo.beanstalk = BEANSTALK.toHexString();
    if (account !== BEANSTALK) {
      silo.farmer = account.toHexString();
    }
    silo.whitelistedTokens = [];
    silo.depositedBDV = ZERO_BI;
    silo.stalk = ZERO_BI;
    silo.plantableStalk = ZERO_BI;
    silo.seeds = ZERO_BI;
    silo.roots = ZERO_BI;
    silo.beanMints = ZERO_BI;
    silo.activeFarmers = 0;
    silo.save();
  }
  return silo as Silo;
}

export function loadSiloHourlySnapshot(account: Address, season: i32, timestamp: BigInt): SiloHourlySnapshot {
  let hour = hourFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + season.toString();
  let snapshot = SiloHourlySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new SiloHourlySnapshot(id);
    let silo = loadSilo(account);
    snapshot.season = season;
    snapshot.silo = account.toHexString();
    snapshot.depositedBDV = silo.depositedBDV;
    snapshot.stalk = silo.stalk;
    snapshot.plantableStalk = silo.plantableStalk;
    snapshot.seeds = silo.seeds;
    snapshot.roots = silo.roots;
    snapshot.beanMints = silo.beanMints;
    snapshot.activeFarmers = silo.activeFarmers;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaStalk = ZERO_BI;
    snapshot.deltaPlantableStalk = ZERO_BI;
    snapshot.deltaSeeds = ZERO_BI;
    snapshot.deltaRoots = ZERO_BI;
    snapshot.deltaBeanMints = ZERO_BI;
    snapshot.deltaActiveFarmers = 0;
    snapshot.createdAt = BigInt.fromString(hour);
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as SiloHourlySnapshot;
}

export function loadSiloDailySnapshot(account: Address, timestamp: BigInt): SiloDailySnapshot {
  let day = dayFromTimestamp(timestamp);
  let id = account.toHexString() + "-" + day.toString();
  let snapshot = SiloDailySnapshot.load(id);
  if (snapshot == null) {
    snapshot = new SiloDailySnapshot(id);
    let silo = loadSilo(account);
    snapshot.season = 0;
    snapshot.silo = account.toHexString();
    snapshot.depositedBDV = silo.depositedBDV;
    snapshot.stalk = silo.stalk;
    snapshot.plantableStalk = silo.plantableStalk;
    snapshot.seeds = silo.seeds;
    snapshot.roots = silo.roots;
    snapshot.beanMints = silo.beanMints;
    snapshot.activeFarmers = silo.activeFarmers;
    snapshot.deltaDepositedBDV = ZERO_BI;
    snapshot.deltaStalk = ZERO_BI;
    snapshot.deltaPlantableStalk = ZERO_BI;
    snapshot.deltaSeeds = ZERO_BI;
    snapshot.deltaRoots = ZERO_BI;
    snapshot.deltaBeanMints = ZERO_BI;
    snapshot.deltaActiveFarmers = 0;
    snapshot.createdAt = BigInt.fromString(day);
    snapshot.updatedAt = timestamp;
    snapshot.save();
  }
  return snapshot as SiloDailySnapshot;
}
