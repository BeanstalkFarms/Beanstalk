import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Silo, SiloDailySnapshot, SiloHourlySnapshot } from "../../generated/schema";
import { getCurrentSeason } from "./Beanstalk";

export function dayFromTimestamp(timestamp: BigInt): string {
  let day_ts = timestamp.toI32() - (timestamp.toI32() % 86400);
  return day_ts.toString();
}

export function hourFromTimestamp(timestamp: BigInt): string {
  let day_ts = timestamp.toI32() - (timestamp.toI32() % 3600);
  return day_ts.toString();
}

// Entities could store a lastSnapshotAt field which can be used to derive both the date and hour.
// This would then become the base for comparison of deltas

export function takeSiloSnapshots(silo: Silo, beanstalk: Address, timestamp: BigInt): void {
  const currentSeason = getCurrentSeason(beanstalk);

  const hour = BigInt.fromString(hourFromTimestamp(timestamp));
  const day = BigInt.fromString(dayFromTimestamp(timestamp));

  // Load the snapshot for this season/day
  const hourlyId = silo.id + "-" + currentSeason.toString();
  const dailyId = silo.id + "-" + day.toString();
  let baseHourly = SiloHourlySnapshot.load(hourlyId);
  let baseDaily = SiloDailySnapshot.load(dailyId);
  if (baseHourly == null && silo.lastHourlySnapshotSeason !== 0) {
    baseHourly = SiloHourlySnapshot.load(silo.id + "-" + silo.lastHourlySnapshotSeason.toString());
  }
  if (baseDaily == null && silo.lastDailySnapshotDay !== null) {
    baseDaily = SiloDailySnapshot.load(silo.id + "-" + silo.lastDailySnapshotDay!.toString());
  }
  const hourly = new SiloHourlySnapshot(hourlyId);
  const daily = new SiloDailySnapshot(dailyId);

  hourly.season = currentSeason;
  hourly.silo = silo.id;
  hourly.depositedBDV = silo.depositedBDV;
  hourly.stalk = silo.stalk;
  hourly.plantableStalk = silo.plantableStalk;
  hourly.seeds = silo.seeds;
  hourly.grownStalkPerSeason = silo.grownStalkPerSeason;
  hourly.roots = silo.roots;
  hourly.germinatingStalk = silo.germinatingStalk;
  hourly.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
  hourly.beanMints = silo.beanMints;
  hourly.activeFarmers = silo.activeFarmers;
  if (baseHourly !== null) {
    hourly.deltaDepositedBDV = hourly.depositedBDV.minus(baseHourly.depositedBDV);
    hourly.deltaStalk = hourly.stalk.minus(baseHourly.stalk);
    hourly.deltaPlantableStalk = hourly.plantableStalk.minus(baseHourly.plantableStalk);
    hourly.deltaSeeds = hourly.seeds.minus(baseHourly.seeds);
    hourly.deltaRoots = hourly.roots.minus(baseHourly.roots);
    hourly.deltaGerminatingStalk = hourly.germinatingStalk.minus(baseHourly.germinatingStalk);
    // NOTE: missing beanToMaxLpGpPerBdvRatio
    hourly.deltaBeanMints = hourly.beanMints.minus(baseHourly.beanMints);
    hourly.deltaActiveFarmers = hourly.activeFarmers - baseHourly.activeFarmers;
    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaDepositedBDV = hourly.deltaDepositedBDV.plus(baseHourly.deltaDepositedBDV);
      hourly.deltaStalk = hourly.deltaStalk.plus(baseHourly.deltaDepositedBDV);
      hourly.deltaPlantableStalk = hourly.deltaPlantableStalk.plus(baseHourly.deltaPlantableStalk);
      hourly.deltaSeeds = hourly.deltaSeeds.plus(baseHourly.deltaSeeds);
      hourly.deltaRoots = hourly.deltaRoots.plus(baseHourly.deltaRoots);
      hourly.deltaGerminatingStalk = hourly.deltaGerminatingStalk.plus(baseHourly.deltaGerminatingStalk);
      // NOTE: missing beanToMaxLpGpPerBdvRatio
      hourly.deltaBeanMints = hourly.deltaBeanMints.plus(baseHourly.deltaBeanMints);
      hourly.deltaActiveFarmers = hourly.deltaActiveFarmers + baseHourly.deltaActiveFarmers;
    }
  } else {
    hourly.deltaDepositedBDV = hourly.depositedBDV;
    hourly.deltaStalk = hourly.stalk;
    hourly.deltaPlantableStalk = hourly.plantableStalk;
    hourly.deltaSeeds = hourly.seeds;
    hourly.deltaRoots = hourly.roots;
    hourly.deltaGerminatingStalk = hourly.germinatingStalk;
    // NOTE: missing beanToMaxLpGpPerBdvRatio
    hourly.deltaBeanMints = hourly.beanMints;
    hourly.deltaActiveFarmers = hourly.activeFarmers;
  }
  hourly.createdAt = hour;
  hourly.updatedAt = timestamp;
  hourly.save();

  silo.lastHourlySnapshotSeason = currentSeason;
  silo.lastDailySnapshotDay = day;
  // Caller must call save on silo. (document this somewhere)
}
