import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { Silo, SiloDailySnapshot, SiloHourlySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";

export function takeSiloSnapshots(silo: Silo, protocol: Address, timestamp: BigInt): void {
  const currentSeason = getCurrentSeason(protocol);

  const hour = BigInt.fromI32(hourFromTimestamp(timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(timestamp));

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

  // Set current values
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

  // Set deltas
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
      hourly.deltaStalk = hourly.deltaStalk.plus(baseHourly.deltaStalk);
      hourly.deltaPlantableStalk = hourly.deltaPlantableStalk.plus(baseHourly.deltaPlantableStalk);
      hourly.deltaSeeds = hourly.deltaSeeds.plus(baseHourly.deltaSeeds);
      hourly.deltaRoots = hourly.deltaRoots.plus(baseHourly.deltaRoots);
      hourly.deltaGerminatingStalk = hourly.deltaGerminatingStalk.plus(baseHourly.deltaGerminatingStalk);
      // NOTE: missing beanToMaxLpGpPerBdvRatio
      hourly.deltaBeanMints = hourly.deltaBeanMints.plus(baseHourly.deltaBeanMints);
      hourly.deltaActiveFarmers = hourly.deltaActiveFarmers + baseHourly.deltaActiveFarmers;
      // Carry over unset values that would otherwise get erased
      hourly.caseId = baseHourly.caseId;
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

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.silo = silo.id;
  daily.depositedBDV = silo.depositedBDV;
  daily.stalk = silo.stalk;
  daily.plantableStalk = silo.plantableStalk;
  daily.seeds = silo.seeds;
  daily.grownStalkPerSeason = silo.grownStalkPerSeason;
  daily.roots = silo.roots;
  daily.germinatingStalk = silo.germinatingStalk;
  daily.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio;
  daily.beanMints = silo.beanMints;
  daily.activeFarmers = silo.activeFarmers;
  if (baseDaily !== null) {
    daily.deltaDepositedBDV = daily.depositedBDV.minus(baseDaily.depositedBDV);
    daily.deltaStalk = daily.stalk.minus(baseDaily.stalk);
    daily.deltaPlantableStalk = daily.plantableStalk.minus(baseDaily.plantableStalk);
    daily.deltaSeeds = daily.seeds.minus(baseDaily.seeds);
    daily.deltaRoots = daily.roots.minus(baseDaily.roots);
    daily.deltaGerminatingStalk = daily.germinatingStalk.minus(baseDaily.germinatingStalk);
    // NOTE: missing beanToMaxLpGpPerBdvRatio
    daily.deltaBeanMints = daily.beanMints.minus(baseDaily.beanMints);
    daily.deltaActiveFarmers = daily.activeFarmers - baseDaily.activeFarmers;
    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaDepositedBDV = daily.deltaDepositedBDV.plus(baseDaily.deltaDepositedBDV);
      daily.deltaStalk = daily.deltaStalk.plus(baseDaily.deltaStalk);
      daily.deltaPlantableStalk = daily.deltaPlantableStalk.plus(baseDaily.deltaPlantableStalk);
      daily.deltaSeeds = daily.deltaSeeds.plus(baseDaily.deltaSeeds);
      daily.deltaRoots = daily.deltaRoots.plus(baseDaily.deltaRoots);
      daily.deltaGerminatingStalk = daily.deltaGerminatingStalk.plus(baseDaily.deltaGerminatingStalk);
      // NOTE: missing beanToMaxLpGpPerBdvRatio
      daily.deltaBeanMints = daily.deltaBeanMints.plus(baseDaily.deltaBeanMints);
      daily.deltaActiveFarmers = daily.deltaActiveFarmers + baseDaily.deltaActiveFarmers;
    }
  } else {
    daily.deltaDepositedBDV = daily.depositedBDV;
    daily.deltaStalk = daily.stalk;
    daily.deltaPlantableStalk = daily.plantableStalk;
    daily.deltaSeeds = daily.seeds;
    daily.deltaRoots = daily.roots;
    daily.deltaGerminatingStalk = daily.germinatingStalk;
    // NOTE: missing beanToMaxLpGpPerBdvRatio
    daily.deltaBeanMints = daily.beanMints;
    daily.deltaActiveFarmers = daily.activeFarmers;
  }
  daily.createdAt = day;
  daily.updatedAt = timestamp;
  daily.save();

  silo.lastHourlySnapshotSeason = currentSeason;
  silo.lastDailySnapshotDay = day;
}

// Set case id on hourly snapshot. Snapshot must have already been created.
export function setSiloHourlyCaseId(caseId: BigInt, silo: Silo): void {
  const hourly = SiloHourlySnapshot.load(silo.id + "-" + silo.lastHourlySnapshotSeason.toString())!;
  hourly.caseId = caseId;
  hourly.save();
}
