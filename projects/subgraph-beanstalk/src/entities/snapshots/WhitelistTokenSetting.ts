import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { WhitelistTokenSetting, WhitelistTokenHourlySnapshot, WhitelistTokenDailySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";

export function takeWhitelistTokenSettingSnapshots(
  whitelistTokenSetting: WhitelistTokenSetting,
  protocol: Address,
  timestamp: BigInt
): void {
  const currentSeason = getCurrentSeason(protocol);

  const hour = BigInt.fromI32(hourFromTimestamp(timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(timestamp));

  // Load the snapshot for this season/day
  const hourlyId = whitelistTokenSetting.id.toHexString() + "-" + currentSeason.toString();
  const dailyId = whitelistTokenSetting.id.toHexString() + "-" + day.toString();
  let baseHourly = WhitelistTokenHourlySnapshot.load(hourlyId);
  let baseDaily = WhitelistTokenDailySnapshot.load(dailyId);
  if (baseHourly == null && whitelistTokenSetting.lastHourlySnapshotSeason !== 0) {
    baseHourly = WhitelistTokenHourlySnapshot.load(
      whitelistTokenSetting.id.toHexString() + "-" + whitelistTokenSetting.lastHourlySnapshotSeason.toString()
    );
  }
  if (baseDaily == null && whitelistTokenSetting.lastDailySnapshotDay !== null) {
    baseDaily = WhitelistTokenDailySnapshot.load(
      whitelistTokenSetting.id.toHexString() + "-" + whitelistTokenSetting.lastDailySnapshotDay!.toString()
    );
  }
  const hourly = new WhitelistTokenHourlySnapshot(hourlyId);
  const daily = new WhitelistTokenDailySnapshot(dailyId);

  // Set current values
  hourly.season = currentSeason;
  hourly.token = whitelistTokenSetting.id;
  hourly.selector = whitelistTokenSetting.selector;
  hourly.gpSelector = whitelistTokenSetting.gpSelector;
  hourly.lwSelector = whitelistTokenSetting.lwSelector;
  hourly.stalkEarnedPerSeason = whitelistTokenSetting.stalkEarnedPerSeason;
  hourly.stalkIssuedPerBdv = whitelistTokenSetting.stalkIssuedPerBdv;
  hourly.milestoneSeason = whitelistTokenSetting.milestoneSeason;
  hourly.gaugePoints = whitelistTokenSetting.gaugePoints;
  hourly.optimalPercentDepositedBdv = whitelistTokenSetting.optimalPercentDepositedBdv;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaStalkEarnedPerSeason = hourly.stalkEarnedPerSeason.minus(baseHourly.stalkEarnedPerSeason);
    hourly.deltaStalkIssuedPerBdv = hourly.stalkIssuedPerBdv.minus(baseHourly.stalkIssuedPerBdv);
    hourly.deltaMilestoneSeason = hourly.milestoneSeason - baseHourly.milestoneSeason;
    if (hourly.gaugePoints !== null) {
      if (baseHourly.gaugePoints !== null) {
        hourly.deltaGaugePoints = hourly.gaugePoints!.minus(baseHourly.gaugePoints!);
      } else {
        hourly.deltaGaugePoints = hourly.gaugePoints;
      }
    }
    if (hourly.optimalPercentDepositedBdv !== null) {
      if (baseHourly.optimalPercentDepositedBdv !== null) {
        hourly.deltaOptimalPercentDepositedBdv = hourly.optimalPercentDepositedBdv!.minus(baseHourly.optimalPercentDepositedBdv!);
      } else {
        hourly.deltaOptimalPercentDepositedBdv = hourly.optimalPercentDepositedBdv;
      }
    }

    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaStalkEarnedPerSeason = hourly.deltaStalkEarnedPerSeason.plus(baseHourly.deltaStalkEarnedPerSeason);
      hourly.deltaStalkIssuedPerBdv = hourly.deltaStalkIssuedPerBdv.plus(baseHourly.deltaStalkIssuedPerBdv);
      hourly.deltaMilestoneSeason = hourly.deltaMilestoneSeason + baseHourly.deltaMilestoneSeason;
      if (hourly.deltaGaugePoints !== null && baseHourly.deltaGaugePoints !== null) {
        hourly.deltaGaugePoints = hourly.deltaGaugePoints!.plus(baseHourly.deltaGaugePoints!);
      }
      if (hourly.deltaOptimalPercentDepositedBdv !== null && baseHourly.deltaOptimalPercentDepositedBdv !== null) {
        hourly.deltaOptimalPercentDepositedBdv = hourly.deltaOptimalPercentDepositedBdv!.plus(baseHourly.deltaOptimalPercentDepositedBdv!);
      }
    }
  } else {
    hourly.deltaStalkEarnedPerSeason = hourly.stalkEarnedPerSeason;
    hourly.deltaStalkIssuedPerBdv = hourly.stalkIssuedPerBdv;
    hourly.deltaMilestoneSeason = hourly.milestoneSeason;
    hourly.deltaGaugePoints = hourly.gaugePoints;
    hourly.deltaOptimalPercentDepositedBdv = hourly.optimalPercentDepositedBdv;
  }
  hourly.createdAt = hour;
  hourly.updatedAt = timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.token = whitelistTokenSetting.id;
  daily.selector = whitelistTokenSetting.selector;
  daily.gpSelector = whitelistTokenSetting.gpSelector;
  daily.lwSelector = whitelistTokenSetting.lwSelector;
  daily.stalkEarnedPerSeason = whitelistTokenSetting.stalkEarnedPerSeason;
  daily.stalkIssuedPerBdv = whitelistTokenSetting.stalkIssuedPerBdv;
  daily.milestoneSeason = whitelistTokenSetting.milestoneSeason;
  daily.gaugePoints = whitelistTokenSetting.gaugePoints;
  daily.optimalPercentDepositedBdv = whitelistTokenSetting.optimalPercentDepositedBdv;
  if (baseDaily !== null) {
    daily.deltaStalkEarnedPerSeason = daily.stalkEarnedPerSeason.minus(baseDaily.stalkEarnedPerSeason);
    daily.deltaStalkIssuedPerBdv = daily.stalkIssuedPerBdv.minus(baseDaily.stalkIssuedPerBdv);
    daily.deltaMilestoneSeason = daily.milestoneSeason - baseDaily.milestoneSeason;
    if (daily.gaugePoints !== null) {
      if (baseDaily.gaugePoints !== null) {
        daily.deltaGaugePoints = daily.gaugePoints!.minus(baseDaily.gaugePoints!);
      } else {
        daily.deltaGaugePoints = daily.gaugePoints;
      }
    }
    if (daily.optimalPercentDepositedBdv !== null) {
      if (baseDaily.optimalPercentDepositedBdv !== null) {
        daily.deltaOptimalPercentDepositedBdv = daily.optimalPercentDepositedBdv!.minus(baseDaily.optimalPercentDepositedBdv!);
      } else {
        daily.deltaOptimalPercentDepositedBdv = daily.optimalPercentDepositedBdv;
      }
    }

    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaStalkEarnedPerSeason = daily.deltaStalkEarnedPerSeason.plus(baseDaily.deltaStalkEarnedPerSeason);
      daily.deltaStalkIssuedPerBdv = daily.deltaStalkIssuedPerBdv.plus(baseDaily.deltaStalkIssuedPerBdv);
      daily.deltaMilestoneSeason = daily.deltaMilestoneSeason + baseDaily.deltaMilestoneSeason;
      if (daily.deltaGaugePoints !== null && baseDaily.deltaGaugePoints !== null) {
        daily.deltaGaugePoints = daily.deltaGaugePoints!.plus(baseDaily.deltaGaugePoints!);
      }
      if (daily.deltaOptimalPercentDepositedBdv !== null && baseDaily.deltaOptimalPercentDepositedBdv !== null) {
        daily.deltaOptimalPercentDepositedBdv = daily.deltaOptimalPercentDepositedBdv!.plus(baseDaily.deltaOptimalPercentDepositedBdv!);
      }
    }
  } else {
    daily.deltaStalkEarnedPerSeason = daily.stalkEarnedPerSeason;
    daily.deltaStalkIssuedPerBdv = daily.stalkIssuedPerBdv;
    daily.deltaMilestoneSeason = daily.milestoneSeason;
    daily.deltaGaugePoints = daily.gaugePoints;
    daily.deltaOptimalPercentDepositedBdv = daily.optimalPercentDepositedBdv;
  }
  daily.createdAt = day;
  daily.updatedAt = timestamp;
  daily.save();

  whitelistTokenSetting.lastHourlySnapshotSeason = currentSeason;
  whitelistTokenSetting.lastDailySnapshotDay = day;
}
