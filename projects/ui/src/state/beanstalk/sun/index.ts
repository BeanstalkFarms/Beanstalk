import BigNumber from 'bignumber.js';
import { DateTime, Duration } from 'luxon';
import { Beanstalk } from '~/generated';
import { bigNumberResult } from '~/util';
import { BlockInfo } from '~/hooks/chain/useFetchLatestBlock';
import {
  APPROX_L2_BLOCK_PER_L1_BLOCK,
  APPROX_SECS_PER_L2_BLOCK,
  BLOCKS_PER_MORNING,
} from './morning';

type Morning = {
  morning: {
    /** The current Block Number on chain */
    blockNumber: BigNumber;
    /** */
    isMorning: boolean;
    /** */
    index: BigNumber;
  };
  morningTime: {
    /** the Duration remaining until the next block update  */
    remaining: Duration;
    /** The DateTime of the next expected block update */
    next: DateTime;
  };
};

export type Sun = {
  // season: BigNumber;
  seasonTime: BigNumber;
  sunrise: {
    /** Whether we're waiting for the sunrise() function to be called. */
    awaiting: boolean;
    /** The DateTime of the next expected Sunrise */
    next: DateTime;
    /** The Duration remaining until the next Sunrise. Updated once per second. */
    remaining: Duration;
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
} & Morning;

export const getNextExpectedSunrise = () => {
  const now = DateTime.now();
  return now.set({ minute: 0, second: 0, millisecond: 0 }).plus({ hour: 1 });
};

export const getNextExpectedBlockUpdate = (
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
 * We determine the current block using the difference in seconds between
 * the current timestamp & the sunriseBlock timestamp.
 *
 * We determine it is morning by calcuating whether we are within 5 mins
 * since sunrise was called.
 *
 */
export const getMorningResult = ({
  timestamp: sunriseTime,
  blockNumber: sunriseBlock,
}: BlockInfo): Morning => {
  // sunrise timestamp in seconds
  const sunriseSecs = sunriseTime.toSeconds();
  // current timestamp in seconds
  const nowSecs = getNowRounded().toSeconds();
  // seconds since sunrise
  const secondsSinceSunrise = nowSecs - sunriseSecs;

  // The approximate number of L2 blocks since sunrise, rounded down
  const deltaBlocks = new BigNumber(
    Math.floor(secondsSinceSunrise / APPROX_SECS_PER_L2_BLOCK)
  );

  // it is morning if
  // - SunriseBlock has been fetched
  // - We are within the first 25 L1 blocks (1200 L2 blocks) since sunrise
  const isMorning =
    deltaBlocks.lt(BLOCKS_PER_MORNING) &&
    deltaBlocks.gte(0) &&
    sunriseBlock.gt(0);

  const blockNumber = sunriseBlock.plus(deltaBlocks);

  // deltablocks = 40
  // 40 / 48 = 0.8333333333333334

  const seconds = deltaBlocks.div(APPROX_L2_BLOCK_PER_L1_BLOCK).toNumber();

  const curr = isMorning
    ? sunriseTime.plus({ seconds })
    : getNextExpectedSunrise().plus({ seconds });

  const next = getNextExpectedBlockUpdate(curr);
  const remaining = getDiffNow(next);

  return {
    morning: {
      isMorning,
      blockNumber,
      index: new BigNumber(deltaBlocks),
    },
    morningTime: {
      next,
      remaining,
    },
  };
};

export * from './reducer';

// 256715605 * 48 =
