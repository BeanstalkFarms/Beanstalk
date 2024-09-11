import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { UnripeToken, UnripeTokenDailySnapshot, UnripeTokenHourlySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";
import { ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function takeUnripeTokenSnapshots(unripeToken: UnripeToken, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();

  const hour = BigInt.fromI32(hourFromTimestamp(block.timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));

  // Load the snapshot for this season/day
  const hourlyId = unripeToken.id.toHexString() + "-" + currentSeason.toString();
  const dailyId = unripeToken.id.toHexString() + "-" + day.toString();
  let baseHourly = UnripeTokenHourlySnapshot.load(hourlyId);
  let baseDaily = UnripeTokenDailySnapshot.load(dailyId);
  if (baseHourly == null && unripeToken.lastHourlySnapshotSeason !== 0) {
    baseHourly = UnripeTokenHourlySnapshot.load(unripeToken.id.toHexString() + "-" + unripeToken.lastHourlySnapshotSeason.toString());
  }
  if (baseDaily == null && unripeToken.lastDailySnapshotDay !== null) {
    baseDaily = UnripeTokenDailySnapshot.load(unripeToken.id.toHexString() + "-" + unripeToken.lastDailySnapshotDay!.toString());
  }
  const hourly = new UnripeTokenHourlySnapshot(hourlyId);
  const daily = new UnripeTokenDailySnapshot(dailyId);

  // Set current values
  hourly.season = currentSeason;
  hourly.unripeToken = unripeToken.id;
  hourly.underlyingToken = unripeToken.underlyingToken;
  hourly.totalUnderlying = unripeToken.totalUnderlying;
  hourly.amountUnderlyingOne = unripeToken.amountUnderlyingOne;
  hourly.bdvUnderlyingOne = unripeToken.bdvUnderlyingOne;
  hourly.choppableAmountOne = unripeToken.choppableAmountOne;
  hourly.choppableBdvOne = unripeToken.choppableBdvOne;
  hourly.chopRate = unripeToken.chopRate;
  hourly.recapPercent = unripeToken.recapPercent;
  hourly.totalChoppedAmount = unripeToken.totalChoppedAmount;
  hourly.totalChoppedBdv = unripeToken.totalChoppedBdv;
  hourly.totalChoppedBdvReceived = unripeToken.totalChoppedBdvReceived;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaUnderlyingToken = hourly.underlyingToken != baseHourly.underlyingToken;
    hourly.deltaTotalUnderlying = hourly.totalUnderlying.minus(baseHourly.totalUnderlying);
    hourly.deltaAmountUnderlyingOne = hourly.amountUnderlyingOne.minus(baseHourly.amountUnderlyingOne);
    hourly.deltaBdvUnderlyingOne = hourly.bdvUnderlyingOne.minus(baseHourly.bdvUnderlyingOne);
    hourly.deltaChoppableAmountOne = hourly.choppableAmountOne.minus(baseHourly.choppableAmountOne);
    hourly.deltaChoppableBdvOne = hourly.choppableBdvOne.minus(baseHourly.choppableBdvOne);
    hourly.deltaChopRate = hourly.chopRate.minus(baseHourly.chopRate);
    hourly.deltaRecapPercent = hourly.recapPercent.minus(baseHourly.recapPercent);
    hourly.deltaTotalChoppedAmount = hourly.totalChoppedAmount.minus(baseHourly.totalChoppedAmount);
    hourly.deltaTotalChoppedBdv = hourly.totalChoppedBdv.minus(baseHourly.totalChoppedBdv);
    hourly.deltaTotalChoppedBdvReceived = hourly.totalChoppedBdvReceived.minus(baseHourly.totalChoppedBdvReceived);

    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaUnderlyingToken = hourly.deltaUnderlyingToken || baseHourly.deltaUnderlyingToken;
      hourly.deltaTotalUnderlying = hourly.deltaTotalUnderlying.plus(baseHourly.deltaTotalUnderlying);
      hourly.deltaAmountUnderlyingOne = hourly.deltaAmountUnderlyingOne.plus(baseHourly.deltaAmountUnderlyingOne);
      hourly.deltaBdvUnderlyingOne = hourly.deltaBdvUnderlyingOne.plus(baseHourly.deltaBdvUnderlyingOne);
      hourly.deltaChoppableAmountOne = hourly.deltaChoppableAmountOne.plus(baseHourly.deltaChoppableAmountOne);
      hourly.deltaChoppableBdvOne = hourly.deltaChoppableBdvOne.plus(baseHourly.deltaChoppableBdvOne);
      hourly.deltaChopRate = hourly.deltaChopRate.plus(baseHourly.deltaChopRate);
      hourly.deltaRecapPercent = hourly.deltaRecapPercent.plus(baseHourly.deltaRecapPercent);
      hourly.deltaTotalChoppedAmount = hourly.deltaTotalChoppedAmount.plus(baseHourly.deltaTotalChoppedAmount);
      hourly.deltaTotalChoppedBdv = hourly.deltaTotalChoppedBdv.plus(baseHourly.deltaTotalChoppedBdv);
      hourly.deltaTotalChoppedBdvReceived = hourly.deltaTotalChoppedBdvReceived.plus(baseHourly.deltaTotalChoppedBdvReceived);
    }
  } else {
    hourly.deltaUnderlyingToken = false;
    hourly.deltaTotalUnderlying = hourly.totalUnderlying;
    hourly.deltaAmountUnderlyingOne = hourly.amountUnderlyingOne;
    hourly.deltaBdvUnderlyingOne = hourly.bdvUnderlyingOne;
    hourly.deltaChoppableAmountOne = hourly.choppableAmountOne;
    hourly.deltaChoppableBdvOne = hourly.choppableBdvOne;
    hourly.deltaChopRate = hourly.chopRate;
    hourly.deltaRecapPercent = hourly.recapPercent;
    hourly.deltaTotalChoppedAmount = hourly.totalChoppedAmount;
    hourly.deltaTotalChoppedBdv = hourly.totalChoppedBdv;
    hourly.deltaTotalChoppedBdvReceived = hourly.totalChoppedBdvReceived;
  }
  hourly.createdAt = hour;
  hourly.updatedAt = block.timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.unripeToken = unripeToken.id;
  daily.underlyingToken = unripeToken.underlyingToken;
  daily.totalUnderlying = unripeToken.totalUnderlying;
  daily.amountUnderlyingOne = unripeToken.amountUnderlyingOne;
  daily.bdvUnderlyingOne = unripeToken.bdvUnderlyingOne;
  daily.choppableAmountOne = unripeToken.choppableAmountOne;
  daily.choppableBdvOne = unripeToken.choppableBdvOne;
  daily.chopRate = unripeToken.chopRate;
  daily.recapPercent = unripeToken.recapPercent;
  daily.totalChoppedAmount = unripeToken.totalChoppedAmount;
  daily.totalChoppedBdv = unripeToken.totalChoppedBdv;
  daily.totalChoppedBdvReceived = unripeToken.totalChoppedBdvReceived;
  if (baseDaily !== null) {
    daily.deltaUnderlyingToken = daily.underlyingToken != baseDaily.underlyingToken;
    daily.deltaTotalUnderlying = daily.totalUnderlying.minus(baseDaily.totalUnderlying);
    daily.deltaAmountUnderlyingOne = daily.amountUnderlyingOne.minus(baseDaily.amountUnderlyingOne);
    daily.deltaBdvUnderlyingOne = daily.bdvUnderlyingOne.minus(baseDaily.bdvUnderlyingOne);
    daily.deltaChoppableAmountOne = daily.choppableAmountOne.minus(baseDaily.choppableAmountOne);
    daily.deltaChoppableBdvOne = daily.choppableBdvOne.minus(baseDaily.choppableBdvOne);
    daily.deltaChopRate = daily.chopRate.minus(baseDaily.chopRate);
    daily.deltaRecapPercent = daily.recapPercent.minus(baseDaily.recapPercent);
    daily.deltaTotalChoppedAmount = daily.totalChoppedAmount.minus(baseDaily.totalChoppedAmount);
    daily.deltaTotalChoppedBdv = daily.totalChoppedBdv.minus(baseDaily.totalChoppedBdv);
    daily.deltaTotalChoppedBdvReceived = daily.totalChoppedBdvReceived.minus(baseDaily.totalChoppedBdvReceived);

    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaUnderlyingToken = daily.deltaUnderlyingToken || baseDaily.deltaUnderlyingToken;
      daily.deltaTotalUnderlying = daily.deltaTotalUnderlying.plus(baseDaily.deltaTotalUnderlying);
      daily.deltaAmountUnderlyingOne = daily.deltaAmountUnderlyingOne.plus(baseDaily.deltaAmountUnderlyingOne);
      daily.deltaBdvUnderlyingOne = daily.deltaBdvUnderlyingOne.plus(baseDaily.deltaBdvUnderlyingOne);
      daily.deltaChoppableAmountOne = daily.deltaChoppableAmountOne.plus(baseDaily.deltaChoppableAmountOne);
      daily.deltaChoppableBdvOne = daily.deltaChoppableBdvOne.plus(baseDaily.deltaChoppableBdvOne);
      daily.deltaChopRate = daily.deltaChopRate.plus(baseDaily.deltaChopRate);
      daily.deltaRecapPercent = daily.deltaRecapPercent.plus(baseDaily.deltaRecapPercent);
      daily.deltaTotalChoppedAmount = daily.deltaTotalChoppedAmount.plus(baseDaily.deltaTotalChoppedAmount);
      daily.deltaTotalChoppedBdv = daily.deltaTotalChoppedBdv.plus(baseDaily.deltaTotalChoppedBdv);
      daily.deltaTotalChoppedBdvReceived = daily.deltaTotalChoppedBdvReceived.plus(baseDaily.deltaTotalChoppedBdvReceived);
    }
  } else {
    daily.deltaUnderlyingToken = false;
    daily.deltaTotalUnderlying = daily.totalUnderlying;
    daily.deltaAmountUnderlyingOne = daily.amountUnderlyingOne;
    daily.deltaBdvUnderlyingOne = daily.bdvUnderlyingOne;
    daily.deltaChoppableAmountOne = daily.choppableAmountOne;
    daily.deltaChoppableBdvOne = daily.choppableBdvOne;
    daily.deltaChopRate = daily.chopRate;
    daily.deltaRecapPercent = daily.recapPercent;
    daily.deltaTotalChoppedAmount = daily.totalChoppedAmount;
    daily.deltaTotalChoppedBdv = daily.totalChoppedBdv;
    daily.deltaTotalChoppedBdvReceived = daily.totalChoppedBdvReceived;
  }
  daily.createdAt = day;
  daily.updatedAt = block.timestamp;
  daily.save();

  unripeToken.lastHourlySnapshotSeason = currentSeason;
  unripeToken.lastDailySnapshotDay = day;
}

export function clearUnripeTokenDeltas(unripeToken: UnripeToken, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));
  const hourly = UnripeTokenHourlySnapshot.load(unripeToken.id.toHexString() + "-" + currentSeason.toString());
  const daily = UnripeTokenDailySnapshot.load(unripeToken.id.toHexString() + "-" + day.toString());
  if (hourly) {
    hourly.deltaUnderlyingToken = false;
    hourly.deltaTotalUnderlying = ZERO_BI;
    hourly.deltaAmountUnderlyingOne = ZERO_BI;
    hourly.deltaBdvUnderlyingOne = ZERO_BI;
    hourly.deltaChoppableAmountOne = ZERO_BI;
    hourly.deltaChoppableBdvOne = ZERO_BI;
    hourly.deltaChopRate = ZERO_BD;
    hourly.deltaRecapPercent = ZERO_BD;
    hourly.deltaTotalChoppedAmount = ZERO_BI;
    hourly.deltaTotalChoppedBdv = ZERO_BI;
    hourly.deltaTotalChoppedBdvReceived = ZERO_BI;
    hourly.save();
  }
  if (daily) {
    daily.deltaUnderlyingToken = false;
    daily.deltaTotalUnderlying = ZERO_BI;
    daily.deltaAmountUnderlyingOne = ZERO_BI;
    daily.deltaBdvUnderlyingOne = ZERO_BI;
    daily.deltaChoppableAmountOne = ZERO_BI;
    daily.deltaChoppableBdvOne = ZERO_BI;
    daily.deltaChopRate = ZERO_BD;
    daily.deltaRecapPercent = ZERO_BD;
    daily.deltaTotalChoppedAmount = ZERO_BI;
    daily.deltaTotalChoppedBdv = ZERO_BI;
    daily.deltaTotalChoppedBdvReceived = ZERO_BI;
    daily.save();
  }
}
