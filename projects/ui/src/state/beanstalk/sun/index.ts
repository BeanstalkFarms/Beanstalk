import BigNumber from 'bignumber.js';
import { DateTime, Duration } from 'luxon';
import { Beanstalk } from '~/generated';
import { bigNumberResult } from '~/util';
import { APPROX_SECS_PER_BLOCK } from './morning';

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
  morning: {
    /** the current morning block 1 - 25 */
    blockNumber: BigNumber;
    blockMap: MorningBlockMap;
    time: {
      /** Whether we are awaiting morning field updates / confirmed block updates */
      awaiting: boolean;
      /** the Duration remaining until the next block update  */
      remaining: Duration;
      /** The DateTime of the next expected block update */
      next: DateTime;
    };
  };
};

export type MorningBlockMap = {
  [_blockNumber: string]: {
    blockNumber: BigNumber;
    timestamp: DateTime;
    next: DateTime;
    offset?: number;
  };
};

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

export const initMorningBlockMap = (sunrise: {
  sunriseBlock: BigNumber;
  timestamp: DateTime;
  offset?: {
    // amount of seconds to offset the timestamp & next times by
    seconds?: number;
    // block in which to start adding the offset
    block?: BigNumber;
  };
}) => {
  const { sunriseBlock, timestamp: _timestamp, offset } = sunrise;
  const offsetSeconds = offset?.seconds || 0;

  return Array(25)
    .fill(null)
    .reduce<MorningBlockMap>((prev, _, i) => {
      const block = sunriseBlock.plus(i);
      const shouldApplyOffset = Boolean(
        (offset?.block || sunriseBlock).lte(block.toNumber())
      );
      const blockSeconds = i * APPROX_SECS_PER_BLOCK;
      const blockOffsetSeconds = shouldApplyOffset ? offsetSeconds : 0;
      const adjustedTimestamp = _timestamp.toSeconds() - blockOffsetSeconds;
      const timestamp = DateTime.fromSeconds(adjustedTimestamp + blockSeconds);

      return {
        [block.toString()]: {
          blockNumber: block,
          timestamp,
          next: timestamp.plus({ seconds: APPROX_SECS_PER_BLOCK }),
          offset: blockOffsetSeconds + blockSeconds,
        },
        ...prev,
      };
    }, {});
};

export const getDiffNow = (dt: DateTime) => {
  const now = Math.floor(DateTime.now().toSeconds());
  return dt.diff(DateTime.fromSeconds(now));
};

export const getNowRounded = () => {
  const now = Math.floor(DateTime.now().toSeconds());
  return DateTime.fromSeconds(now);
};

export * from './reducer';
