import BigNumber from 'bignumber.js';
import { DateTime, Duration } from 'luxon';
import { Beanstalk } from '~/generated';
import { bigNumberResult } from '~/util';
import { BlockInfo } from '~/hooks/chain/useFetchLatestBlock';
import {
  APPROX_L2_BLOCK_PER_L1_BLOCK,
  APPROX_SECS_PER_L2_BLOCK,
  INTERVALS_PER_MORNING,
  SECONDS_PER_MORNING_INTERVAL,
} from './morning';

export interface Morning {
  /**
   * The L2 Block Number that represents the start of the current morning interval.
   */
  blockNumber: BigNumber;
  /**
   * Whether it is morning
   */
  isMorning: boolean;
  /**
   * The index (0 - 24) of the current morning.
   * Can think of this as 12 second intervals (L1 blocks) since sunrise
   */
  index: BigNumber;
  /**
   * The DateTime of the next expected morning interval update
   */
  next: DateTime;
}

export type Sun = {
  // season: BigNumber;
  seasonTime: BigNumber;
  sunrise: {
    /** Whether we're waiting for the sunrise() function to be called. */
    awaiting: boolean;
    /** The DateTime of the next expected Sunrise */
    next: DateTime;
  };
  season: {
    current: BigNumber;
    lastSop: BigNumber;
    withdrawSeasons: BigNumber;
    lastSopSeason: BigNumber;
    rainStart: BigNumber;
    raining: boolean;
    fertilizing: boolean;
    sunriseBlock: BigNumber;
    abovePeg: boolean;
    start: BigNumber;
    period: BigNumber;
    timestamp: DateTime;
  };
  morning: Morning;
};

export const getNextExpectedSunrise = () => {
  const now = DateTime.now();
  return now.set({ minute: 0, second: 0, millisecond: 0 }).plus({ hour: 1 });
};

export const getNextMorningIntervalUpdate = (
  from: DateTime = getNextExpectedSunrise()
) => from.plus({ seconds: 12 });

export const parseSeasonResult = (
  // eslint-disable-next-line no-undef
  result: Awaited<ReturnType<Beanstalk['time']>>
): Sun['season'] => ({
  current: bigNumberResult(result.current), /// The current Season in Beanstalk.
  lastSop: bigNumberResult(result.lastSop), /// The Season in which the most recent consecutive series of Seasons of Plenty started.
  withdrawSeasons: bigNumberResult(result.withdrawSeasons), /// The number of Seasons required to Withdraw a Deposit.
  lastSopSeason: bigNumberResult(result.lastSopSeason), /// The Season in which the most recent consecutive series of Seasons of Plenty ended.
  rainStart: bigNumberResult(result.rainStart), /// The most recent Season in which Rain started.
  raining: result.raining, /// True if it is Raining (P > 1, Pod Rate Excessively Low).
  fertilizing: result.fertilizing, /// True if Beanstalk has Fertilizer left to be paid off.
  sunriseBlock: bigNumberResult(result.sunriseBlock), /// The block of the start of the current Season.
  abovePeg: result.abovePeg, /// Boolean indicating whether the previous Season was above or below peg.
  start: bigNumberResult(result.start), /// The timestamp of the Beanstalk deployment rounded down to the nearest hour.
  period: bigNumberResult(result.period), /// The length of each season in Beanstalk in seconds.
  timestamp: DateTime.fromSeconds(bigNumberResult(result.timestamp).toNumber()), /// The timestamp of the start of the current Season.
});

/**
 * diff between some data & now rounded down to the nearest second
 * @param dt - the DateTime to calculate the difference from
 * @param _now - the current DateTime (defaults to now)
 */
export const getDiffNow = (dt: DateTime, _now?: DateTime) => {
  const now = (_now || DateTime.now()).toSeconds();
  const nowRounded = Math.floor(now);
  return dt.diff(DateTime.fromSeconds(nowRounded));
};

/**
 * current timestamp rounded down to the nearest second
 */
export const getNowRounded = () => {
  const now = Math.floor(DateTime.now().toSeconds());
  return DateTime.fromSeconds(now);
};

/**
 * @param timestamp the timestamp of the block in which gm() was called
 * @param blockNumber the blockNumber of the block in which gm() was called
 *
 * Ethereum block times don't include MS, so we use the current timestamp
 * rounded down to the nearest second.
 *
 * We approximate the current block using the difference in seconds between
 * the current timestamp & the sunriseBlock timestamp.
 *
 * We determine it is morning by calculating whether we are within 5 mins
 * since sunrise was called.
 *
 */
export const getMorningResult = ({
  timestamp: sunriseTime,
  blockNumber: sunriseBlock,
}: BlockInfo): Morning & {
  remaining: Duration;
} => {
  // sunrise timestamp in seconds
  const sunriseSecs = Math.floor(sunriseTime.toSeconds());
  // current timestamp in seconds
  const nowSecs = getNowRounded().toSeconds();
  // seconds since sunrise
  const secondsSinceSunrise = Math.floor(nowSecs - sunriseSecs);

  // The morning interval index (0 - 24)
  const index = new BigNumber(
    Math.floor(secondsSinceSunrise / SECONDS_PER_MORNING_INTERVAL)
  );
  // The approximate blockNumber that represents the start the current morning interval
  const deltaBlocks = index.times(APPROX_L2_BLOCK_PER_L1_BLOCK);

  // It is considered morning if...
  // - SunriseBlock has been fetched
  // - We are within the first 25 L1 blocks (1200 L2 blocks) since sunrise
  const isMorning =
    index.gte(0) && index.lt(INTERVALS_PER_MORNING) && sunriseBlock.gt(0);

  // The L2 Block Number that represents the start of the current morning interval
  const blockNumber = sunriseBlock.plus(deltaBlocks);

  // we could use secondsSinceSunrise, but this is more precise.
  // Using secondsSinceSunrise results in 0.5s inaccuracy.
  const elapsedSeconds = deltaBlocks.times(APPROX_SECS_PER_L2_BLOCK);

  const curr = isMorning
    ? sunriseTime.plus({ seconds: elapsedSeconds.toNumber() })
    : getNextExpectedSunrise().plus({ seconds: 12 });

  const next = getNextMorningIntervalUpdate(curr);
  const remaining = getDiffNow(next);

  console.log({
    sunriseSecs,
    nowSecs,
    secondsSinceSunrise,
    index: index.toNumber(),
    deltaBlocks: deltaBlocks.toNumber(),
    blockNumber: blockNumber.toNumber(),
  });

  return {
    remaining,
    isMorning,
    blockNumber,
    index,
    next,
  };
};

export * from './reducer';
