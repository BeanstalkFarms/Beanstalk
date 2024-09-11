import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { PodMarketplace, PodMarketplaceDailySnapshot, PodMarketplaceHourlySnapshot } from "../../../generated/schema";
import { getCurrentSeason } from "../Beanstalk";
import { dayFromTimestamp, hourFromTimestamp } from "../../../../subgraph-core/utils/Dates";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

export function takeMarketSnapshots(market: PodMarketplace, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();

  const hour = BigInt.fromI32(hourFromTimestamp(block.timestamp));
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));

  // Load the snapshot for this season/day
  const hourlyId = market.id + "-" + currentSeason.toString();
  const dailyId = market.id + "-" + day.toString();
  let baseHourly = PodMarketplaceHourlySnapshot.load(hourlyId);
  let baseDaily = PodMarketplaceDailySnapshot.load(dailyId);
  if (baseHourly == null && market.lastHourlySnapshotSeason !== 0) {
    baseHourly = PodMarketplaceHourlySnapshot.load(market.id + "-" + market.lastHourlySnapshotSeason.toString());
  }
  if (baseDaily == null && market.lastDailySnapshotDay !== null) {
    baseDaily = PodMarketplaceDailySnapshot.load(market.id + "-" + market.lastDailySnapshotDay!.toString());
  }
  const hourly = new PodMarketplaceHourlySnapshot(hourlyId);
  const daily = new PodMarketplaceDailySnapshot(dailyId);

  // Set current values
  hourly.season = currentSeason;
  hourly.podMarketplace = market.id;
  hourly.listedPods = market.listedPods;
  hourly.availableListedPods = market.availableListedPods;
  hourly.filledListedPods = market.filledListedPods;
  hourly.expiredListedPods = market.expiredListedPods;
  hourly.cancelledListedPods = market.cancelledListedPods;
  hourly.orderBeans = market.orderBeans;
  hourly.availableOrderBeans = market.availableOrderBeans;
  hourly.filledOrderBeans = market.filledOrderBeans;
  hourly.filledOrderedPods = market.filledOrderedPods;
  hourly.cancelledOrderBeans = market.cancelledOrderBeans;
  hourly.podVolume = market.podVolume;
  hourly.beanVolume = market.beanVolume;

  // Set deltas
  if (baseHourly !== null) {
    hourly.deltaListedPods = hourly.listedPods.minus(baseHourly.listedPods);
    hourly.deltaAvailableListedPods = hourly.availableListedPods.minus(baseHourly.availableListedPods);
    hourly.deltaFilledListedPods = hourly.filledListedPods.minus(baseHourly.filledListedPods);
    hourly.deltaExpiredListedPods = hourly.expiredListedPods.minus(baseHourly.expiredListedPods);
    hourly.deltaCancelledListedPods = hourly.cancelledListedPods.minus(baseHourly.cancelledListedPods);
    hourly.deltaOrderBeans = hourly.orderBeans.minus(baseHourly.orderBeans);
    hourly.deltaAvailableOrderBeans = hourly.availableOrderBeans.minus(baseHourly.availableOrderBeans);
    hourly.deltaFilledOrderBeans = hourly.filledOrderBeans.minus(baseHourly.filledOrderBeans);
    hourly.deltaFilledOrderedPods = hourly.filledOrderedPods.minus(baseHourly.filledOrderedPods);
    hourly.deltaCancelledOrderBeans = hourly.cancelledOrderBeans.minus(baseHourly.cancelledOrderBeans);
    hourly.deltaPodVolume = hourly.podVolume.minus(baseHourly.podVolume);
    hourly.deltaBeanVolume = hourly.beanVolume.minus(baseHourly.beanVolume);

    if (hourly.id == baseHourly.id) {
      // Add existing deltas
      hourly.deltaListedPods = hourly.deltaListedPods.plus(baseHourly.deltaListedPods);
      hourly.deltaAvailableListedPods = hourly.deltaAvailableListedPods.plus(baseHourly.deltaAvailableListedPods);
      hourly.deltaFilledListedPods = hourly.deltaFilledListedPods.plus(baseHourly.deltaFilledListedPods);
      hourly.deltaExpiredListedPods = hourly.deltaExpiredListedPods.plus(baseHourly.deltaExpiredListedPods);
      hourly.deltaCancelledListedPods = hourly.deltaCancelledListedPods.plus(baseHourly.deltaCancelledListedPods);
      hourly.deltaOrderBeans = hourly.deltaOrderBeans.plus(baseHourly.deltaOrderBeans);
      hourly.deltaAvailableOrderBeans = hourly.deltaAvailableOrderBeans.plus(baseHourly.deltaAvailableOrderBeans);
      hourly.deltaFilledOrderBeans = hourly.deltaFilledOrderBeans.plus(baseHourly.deltaFilledOrderBeans);
      hourly.deltaFilledOrderedPods = hourly.deltaFilledOrderedPods.plus(baseHourly.deltaFilledOrderedPods);
      hourly.deltaCancelledOrderBeans = hourly.deltaCancelledOrderBeans.plus(baseHourly.deltaCancelledOrderBeans);
      hourly.deltaPodVolume = hourly.deltaPodVolume.plus(baseHourly.deltaPodVolume);
      hourly.deltaBeanVolume = hourly.deltaBeanVolume.plus(baseHourly.deltaBeanVolume);
    }
  } else {
    hourly.deltaListedPods = hourly.listedPods;
    hourly.deltaAvailableListedPods = hourly.availableListedPods;
    hourly.deltaFilledListedPods = hourly.filledListedPods;
    hourly.deltaExpiredListedPods = hourly.expiredListedPods;
    hourly.deltaCancelledListedPods = hourly.cancelledListedPods;
    hourly.deltaOrderBeans = hourly.orderBeans;
    hourly.deltaAvailableOrderBeans = hourly.availableOrderBeans;
    hourly.deltaFilledOrderBeans = hourly.filledOrderBeans;
    hourly.deltaFilledOrderedPods = hourly.filledOrderedPods;
    hourly.deltaCancelledOrderBeans = hourly.cancelledOrderBeans;
    hourly.deltaPodVolume = hourly.podVolume;
    hourly.deltaBeanVolume = hourly.beanVolume;
  }
  hourly.createdAt = hour;
  hourly.updatedAt = block.timestamp;
  hourly.save();

  // Repeat for daily snapshot.
  // Duplicate code is preferred to type coercion, the codegen doesnt provide a common interface.

  daily.season = currentSeason;
  daily.podMarketplace = market.id;
  daily.listedPods = market.listedPods;
  daily.availableListedPods = market.availableListedPods;
  daily.filledListedPods = market.filledListedPods;
  daily.expiredListedPods = market.expiredListedPods;
  daily.cancelledListedPods = market.cancelledListedPods;
  daily.orderBeans = market.orderBeans;
  daily.availableOrderBeans = market.availableOrderBeans;
  daily.filledOrderBeans = market.filledOrderBeans;
  daily.filledOrderedPods = market.filledOrderedPods;
  daily.cancelledOrderBeans = market.cancelledOrderBeans;
  daily.podVolume = market.podVolume;
  daily.beanVolume = market.beanVolume;
  if (baseDaily !== null) {
    daily.deltaListedPods = daily.listedPods.minus(baseDaily.listedPods);
    daily.deltaAvailableListedPods = daily.availableListedPods.minus(baseDaily.availableListedPods);
    daily.deltaFilledListedPods = daily.filledListedPods.minus(baseDaily.filledListedPods);
    daily.deltaExpiredListedPods = daily.expiredListedPods.minus(baseDaily.expiredListedPods);
    daily.deltaCancelledListedPods = daily.cancelledListedPods.minus(baseDaily.cancelledListedPods);
    daily.deltaOrderBeans = daily.orderBeans.minus(baseDaily.orderBeans);
    daily.deltaAvailableOrderBeans = daily.availableOrderBeans.minus(baseDaily.availableOrderBeans);
    daily.deltaFilledOrderBeans = daily.filledOrderBeans.minus(baseDaily.filledOrderBeans);
    daily.deltaFilledOrderedPods = daily.filledOrderedPods.minus(baseDaily.filledOrderedPods);
    daily.deltaCancelledOrderBeans = daily.cancelledOrderBeans.minus(baseDaily.cancelledOrderBeans);
    daily.deltaPodVolume = daily.podVolume.minus(baseDaily.podVolume);
    daily.deltaBeanVolume = daily.beanVolume.minus(baseDaily.beanVolume);

    if (daily.id == baseDaily.id) {
      // Add existing deltas
      daily.deltaListedPods = daily.deltaListedPods.plus(baseDaily.deltaListedPods);
      daily.deltaAvailableListedPods = daily.deltaAvailableListedPods.plus(baseDaily.deltaAvailableListedPods);
      daily.deltaFilledListedPods = daily.deltaFilledListedPods.plus(baseDaily.deltaFilledListedPods);
      daily.deltaExpiredListedPods = daily.deltaExpiredListedPods.plus(baseDaily.deltaExpiredListedPods);
      daily.deltaCancelledListedPods = daily.deltaCancelledListedPods.plus(baseDaily.deltaCancelledListedPods);
      daily.deltaOrderBeans = daily.deltaOrderBeans.plus(baseDaily.deltaOrderBeans);
      daily.deltaAvailableOrderBeans = daily.deltaAvailableOrderBeans.plus(baseDaily.deltaAvailableOrderBeans);
      daily.deltaFilledOrderBeans = daily.deltaFilledOrderBeans.plus(baseDaily.deltaFilledOrderBeans);
      daily.deltaFilledOrderedPods = daily.deltaFilledOrderedPods.plus(baseDaily.deltaFilledOrderedPods);
      daily.deltaCancelledOrderBeans = daily.deltaCancelledOrderBeans.plus(baseDaily.deltaCancelledOrderBeans);
      daily.deltaPodVolume = daily.deltaPodVolume.plus(baseDaily.deltaPodVolume);
      daily.deltaBeanVolume = daily.deltaBeanVolume.plus(baseDaily.deltaBeanVolume);
    }
  } else {
    daily.deltaListedPods = daily.listedPods;
    daily.deltaAvailableListedPods = daily.availableListedPods;
    daily.deltaFilledListedPods = daily.filledListedPods;
    daily.deltaExpiredListedPods = daily.expiredListedPods;
    daily.deltaCancelledListedPods = daily.cancelledListedPods;
    daily.deltaOrderBeans = daily.orderBeans;
    daily.deltaAvailableOrderBeans = daily.availableOrderBeans;
    daily.deltaFilledOrderBeans = daily.filledOrderBeans;
    daily.deltaFilledOrderedPods = daily.filledOrderedPods;
    daily.deltaCancelledOrderBeans = daily.cancelledOrderBeans;
    daily.deltaPodVolume = daily.podVolume;
    daily.deltaBeanVolume = daily.beanVolume;
  }
  daily.createdAt = day;
  daily.updatedAt = block.timestamp;
  daily.save();

  market.lastHourlySnapshotSeason = currentSeason;
  market.lastDailySnapshotDay = day;
}

export function clearMarketDeltas(market: PodMarketplace, block: ethereum.Block): void {
  const currentSeason = getCurrentSeason();
  const day = BigInt.fromI32(dayFromTimestamp(block.timestamp));
  const hourly = PodMarketplaceHourlySnapshot.load(market.id + "-" + currentSeason.toString());
  const daily = PodMarketplaceDailySnapshot.load(market.id + "-" + day.toString());
  if (hourly != null) {
    hourly.deltaListedPods = ZERO_BI;
    hourly.deltaAvailableListedPods = ZERO_BI;
    hourly.deltaFilledListedPods = ZERO_BI;
    hourly.deltaExpiredListedPods = ZERO_BI;
    hourly.deltaCancelledListedPods = ZERO_BI;
    hourly.deltaOrderBeans = ZERO_BI;
    hourly.deltaAvailableOrderBeans = ZERO_BI;
    hourly.deltaFilledOrderBeans = ZERO_BI;
    hourly.deltaFilledOrderedPods = ZERO_BI;
    hourly.deltaCancelledOrderBeans = ZERO_BI;
    hourly.deltaPodVolume = ZERO_BI;
    hourly.deltaBeanVolume = ZERO_BI;
    hourly.save();
  }
  if (daily != null) {
    daily.deltaListedPods = ZERO_BI;
    daily.deltaAvailableListedPods = ZERO_BI;
    daily.deltaFilledListedPods = ZERO_BI;
    daily.deltaExpiredListedPods = ZERO_BI;
    daily.deltaCancelledListedPods = ZERO_BI;
    daily.deltaOrderBeans = ZERO_BI;
    daily.deltaAvailableOrderBeans = ZERO_BI;
    daily.deltaFilledOrderBeans = ZERO_BI;
    daily.deltaFilledOrderedPods = ZERO_BI;
    daily.deltaCancelledOrderBeans = ZERO_BI;
    daily.deltaPodVolume = ZERO_BI;
    daily.deltaBeanVolume = ZERO_BI;
    daily.save();
  }
}
