import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { WhitelistTokenSetting, WhitelistTokenHourlySnapshot, WhitelistTokenDailySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function takeWhitelistTokenSettingSnapshots(whitelistTokenSetting: WhitelistTokenSetting, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();

  const hour = BigInt.fromI32(hourFromTimestamp(block.timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));

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
  hourly.stalkEarnedPerSeason = whitelistTokenSetting.stalkEarnedPerSeason;
  hourly.stalkIssuedPerBdv = whitelistTokenSetting.stalkIssuedPerBdv;
  hourly.milestoneSeason = whitelistTokenSetting.milestoneSeason;
  hourly.isGaugeEnabled = whitelistTokenSetting.isGaugeEnabled;
  hourly.gaugePoints = whitelistTokenSetting.gaugePoints;
  hourly.optimalPercentDepositedBdv = whitelistTokenSetting.optimalPercentDepositedBdv;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaStalkEarnedPerSeason = hourly.stalkEarnedPerSeason.minus(baseHourly.stalkEarnedPerSeason);
    hourly.deltaStalkIssuedPerBdv = hourly.stalkIssuedPerBdv.minus(baseHourly.stalkIssuedPerBdv);
    hourly.deltaMilestoneSeason = hourly.milestoneSeason - baseHourly.milestoneSeason;
    hourly.deltaIsGaugeEnabled = hourly.isGaugeEnabled != baseHourly.isGaugeEnabled;
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
      hourly.deltaIsGaugeEnabled = hourly.deltaIsGaugeEnabled != baseHourly.deltaIsGaugeEnabled;
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
    hourly.deltaIsGaugeEnabled = hourly.isGaugeEnabled;
    hourly.deltaGaugePoints = hourly.gaugePoints;
    hourly.deltaOptimalPercentDepositedBdv = hourly.optimalPercentDepositedBdv;
  }
  hourly.createdAt = hour.times(BigInt.fromU32(3600));
  hourly.updatedAt = block.timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.token = whitelistTokenSetting.id;
  daily.selector = whitelistTokenSetting.selector;
  daily.stalkEarnedPerSeason = whitelistTokenSetting.stalkEarnedPerSeason;
  daily.stalkIssuedPerBdv = whitelistTokenSetting.stalkIssuedPerBdv;
  daily.milestoneSeason = whitelistTokenSetting.milestoneSeason;
  daily.isGaugeEnabled = whitelistTokenSetting.isGaugeEnabled;
  daily.gaugePoints = whitelistTokenSetting.gaugePoints;
  daily.optimalPercentDepositedBdv = whitelistTokenSetting.optimalPercentDepositedBdv;
  if (baseDaily !== null) {
    daily.deltaStalkEarnedPerSeason = daily.stalkEarnedPerSeason.minus(baseDaily.stalkEarnedPerSeason);
    daily.deltaStalkIssuedPerBdv = daily.stalkIssuedPerBdv.minus(baseDaily.stalkIssuedPerBdv);
    daily.deltaMilestoneSeason = daily.milestoneSeason - baseDaily.milestoneSeason;
    daily.deltaIsGaugeEnabled = daily.isGaugeEnabled != baseDaily.isGaugeEnabled;
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
      daily.deltaIsGaugeEnabled = daily.deltaIsGaugeEnabled != baseDaily.deltaIsGaugeEnabled;
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
    daily.deltaIsGaugeEnabled = daily.isGaugeEnabled;
    daily.deltaGaugePoints = daily.gaugePoints;
    daily.deltaOptimalPercentDepositedBdv = daily.optimalPercentDepositedBdv;
  }
  daily.createdAt = day.times(BigInt.fromU32(86400));
  daily.updatedAt = block.timestamp;
  daily.save();

  whitelistTokenSetting.lastHourlySnapshotSeason = currentSeason;
  whitelistTokenSetting.lastDailySnapshotDay = day;
}

export function clearWhitelistTokenSettingDeltas(whitelistTokenSetting: WhitelistTokenSetting, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));
  const hourly = WhitelistTokenHourlySnapshot.load(whitelistTokenSetting.id.toHexString() + "-" + currentSeason.toString());
  const daily = WhitelistTokenDailySnapshot.load(whitelistTokenSetting.id.toHexString() + "-" + day.toString());
  if (hourly != null) {
    hourly.deltaStalkEarnedPerSeason = ZERO_BI;
    hourly.deltaStalkIssuedPerBdv = ZERO_BI;
    hourly.deltaMilestoneSeason = 0;
    hourly.deltaGaugePoints = ZERO_BI;
    if (hourly.deltaOptimalPercentDepositedBdv != null) {
      hourly.deltaOptimalPercentDepositedBdv = ZERO_BI;
    }
    hourly.save();
  }
  if (daily != null) {
    daily.deltaStalkEarnedPerSeason = ZERO_BI;
    daily.deltaStalkIssuedPerBdv = ZERO_BI;
    daily.deltaMilestoneSeason = 0;
    daily.deltaGaugePoints = ZERO_BI;
    if (daily.deltaOptimalPercentDepositedBdv != null) {
      daily.deltaOptimalPercentDepositedBdv = ZERO_BI;
    }
    daily.save();
  }
}

// Set bdv on hourly and daily. Snapshots must have already been created.
export function setBdv(bdv: BigInt, whitelistTokenSetting: WhitelistTokenSetting): void {
  const hourly = WhitelistTokenHourlySnapshot.load(
    whitelistTokenSetting.id.toHexString() + "-" + whitelistTokenSetting.lastHourlySnapshotSeason.toString()
  )!;
  const daily = WhitelistTokenDailySnapshot.load(
    whitelistTokenSetting.id.toHexString() + "-" + whitelistTokenSetting.lastDailySnapshotDay!.toString()
  )!;

  hourly.bdv = bdv;
  daily.bdv = bdv;

  // Delta cannot be managed by the default snapshot method because the bdv is unsuitable for calculation during that
  // method (contract call). Previous season's snapshots can be accessed by subtracting one
  // (the current season snapshots were already created)
  const prevHourly = WhitelistTokenHourlySnapshot.load(
    whitelistTokenSetting.id.toHexString() + "-" + (whitelistTokenSetting.lastHourlySnapshotSeason - 1).toString()
  );
  const prevDaily = WhitelistTokenDailySnapshot.load(
    whitelistTokenSetting.id.toHexString() + "-" + (whitelistTokenSetting.lastDailySnapshotDay!.toI32() - 1).toString()
  );

  if (prevHourly != null && prevHourly.bdv !== null) {
    hourly.deltaBdv = hourly.bdv!.minus(prevHourly.bdv!);
  } else {
    hourly.deltaBdv = hourly.bdv;
  }
  if (prevDaily != null && prevDaily.bdv !== null) {
    daily.deltaBdv = daily.bdv!.minus(prevDaily.bdv!);
  } else {
    daily.deltaBdv = daily.bdv;
  }

  hourly.save();
  daily.save();
}

// Returns the latest hourly bdv for the requested token. Can be null if bdv function isnt implemented onchain yet.
export function getLatestBdv(whitelistTokenSetting: WhitelistTokenSetting): BigInt | null {
  const hourly = WhitelistTokenHourlySnapshot.load(
    whitelistTokenSetting.id.toHexString() + "-" + whitelistTokenSetting.lastHourlySnapshotSeason.toString()
  )!;
  return hourly.bdv;
}
