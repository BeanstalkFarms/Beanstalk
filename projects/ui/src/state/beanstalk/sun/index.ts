import BigNumber from 'bignumber.js';
import { DateTime, Duration } from 'luxon';
import { Beanstalk } from '~/generated';
import { bigNumberResult } from '~/util';

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
    timestamp: BigNumber;
  };
};

export const getNextExpectedSunrise = () => {
  const now = DateTime.now();
  return now.set({ minute: 0, second: 0, millisecond: 0 }).plus({ hour: 1 });
};

// eslint-disable-next-line no-undef
export const parseSeasonResult = (
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
  timestamp: bigNumberResult(result.timestamp), /// The timestamp of the start of the current Season.
});
