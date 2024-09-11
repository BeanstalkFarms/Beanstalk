import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { SiloAsset, SiloAssetDailySnapshot, SiloAssetHourlySnapshot } from "../../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";
import { getCurrentSeason } from "../Beanstalk";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function takeSiloAssetSnapshots(siloAsset: SiloAsset, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();

  const hour = BigInt.fromI32(hourFromTimestamp(block.timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));

  // Load the snapshot for this season/day
  const hourlyId = siloAsset.id + "-" + currentSeason.toString();
  const dailyId = siloAsset.id + "-" + day.toString();
  let baseHourly = SiloAssetHourlySnapshot.load(hourlyId);
  let baseDaily = SiloAssetDailySnapshot.load(dailyId);
  if (baseHourly == null && siloAsset.lastHourlySnapshotSeason !== 0) {
    baseHourly = SiloAssetHourlySnapshot.load(siloAsset.id + "-" + siloAsset.lastHourlySnapshotSeason.toString());
  }
  if (baseDaily == null && siloAsset.lastDailySnapshotDay !== null) {
    baseDaily = SiloAssetDailySnapshot.load(siloAsset.id + "-" + siloAsset.lastDailySnapshotDay!.toString());
  }
  const hourly = new SiloAssetHourlySnapshot(hourlyId);
  const daily = new SiloAssetDailySnapshot(dailyId);

  // Set current values
  hourly.season = currentSeason;
  hourly.siloAsset = siloAsset.id;
  hourly.depositedAmount = siloAsset.depositedAmount;
  hourly.depositedBDV = siloAsset.depositedBDV;
  hourly.withdrawnAmount = siloAsset.withdrawnAmount;
  hourly.farmAmount = siloAsset.farmAmount;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaDepositedAmount = hourly.depositedAmount.minus(baseHourly.depositedAmount);
    hourly.deltaDepositedBDV = hourly.depositedBDV.minus(baseHourly.depositedBDV);
    hourly.deltaWithdrawnAmount = hourly.withdrawnAmount.minus(baseHourly.withdrawnAmount);
    hourly.deltaFarmAmount = hourly.farmAmount.minus(baseHourly.farmAmount);

    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaDepositedAmount = hourly.deltaDepositedAmount.plus(baseHourly.deltaDepositedAmount);
      hourly.deltaDepositedBDV = hourly.deltaDepositedBDV.plus(baseHourly.deltaDepositedBDV);
      hourly.deltaWithdrawnAmount = hourly.deltaWithdrawnAmount.plus(baseHourly.deltaWithdrawnAmount);
      hourly.deltaFarmAmount = hourly.deltaFarmAmount.plus(baseHourly.deltaFarmAmount);
    }
  } else {
    hourly.deltaDepositedAmount = hourly.depositedAmount;
    hourly.deltaDepositedBDV = hourly.depositedBDV;
    hourly.deltaWithdrawnAmount = hourly.withdrawnAmount;
    hourly.deltaFarmAmount = hourly.farmAmount;
  }
  hourly.createdAt = hour;
  hourly.updatedAt = block.timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.siloAsset = siloAsset.id;
  daily.depositedAmount = siloAsset.depositedAmount;
  daily.depositedBDV = siloAsset.depositedBDV;
  daily.withdrawnAmount = siloAsset.withdrawnAmount;
  daily.farmAmount = siloAsset.farmAmount;
  if (baseDaily !== null) {
    daily.deltaDepositedAmount = daily.depositedAmount.minus(baseDaily.depositedAmount);
    daily.deltaDepositedBDV = daily.depositedBDV.minus(baseDaily.depositedBDV);
    daily.deltaWithdrawnAmount = daily.withdrawnAmount.minus(baseDaily.withdrawnAmount);
    daily.deltaFarmAmount = daily.farmAmount.minus(baseDaily.farmAmount);

    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaDepositedAmount = daily.deltaDepositedAmount.plus(baseDaily.deltaDepositedAmount);
      daily.deltaDepositedBDV = daily.deltaDepositedBDV.plus(baseDaily.deltaDepositedBDV);
      daily.deltaWithdrawnAmount = daily.deltaWithdrawnAmount.plus(baseDaily.deltaWithdrawnAmount);
      daily.deltaFarmAmount = daily.deltaFarmAmount.plus(baseDaily.deltaFarmAmount);
    }
  } else {
    daily.deltaDepositedAmount = daily.depositedAmount;
    daily.deltaDepositedBDV = daily.depositedBDV;
    daily.deltaWithdrawnAmount = daily.withdrawnAmount;
    daily.deltaFarmAmount = daily.farmAmount;
  }
  daily.createdAt = day;
  daily.updatedAt = block.timestamp;
  daily.save();

  siloAsset.lastHourlySnapshotSeason = currentSeason;
  siloAsset.lastDailySnapshotDay = day;
}

export function clearSiloAssetDeltas(siloAsset: SiloAsset, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));
  const hourly = SiloAssetHourlySnapshot.load(siloAsset.id + "-" + currentSeason.toString());
  const daily = SiloAssetDailySnapshot.load(siloAsset.id + "-" + day.toString());
  if (hourly != null) {
    hourly.deltaDepositedAmount = ZERO_BI;
    hourly.deltaDepositedBDV = ZERO_BI;
    hourly.deltaWithdrawnAmount = ZERO_BI;
    hourly.deltaFarmAmount = ZERO_BI;
    hourly.save();
  }
  if (daily != null) {
    daily.deltaDepositedAmount = ZERO_BI;
    daily.deltaDepositedBDV = ZERO_BI;
    daily.deltaWithdrawnAmount = ZERO_BI;
    daily.deltaFarmAmount = ZERO_BI;
    daily.save();
  }
}
