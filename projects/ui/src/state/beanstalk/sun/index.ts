import BigNumber from 'bignumber.js';
import { DateTime, Duration } from 'luxon';

export type Sun = {
  season: BigNumber;
  seasonTime: BigNumber;
  sunrise: {
    /** Whether we're waiting for the sunrise() function to be called. */
    awaiting: boolean;
    /** The DateTime of the next expected Sunrise */
    next: DateTime;
    /** The Duration remaining until the next Sunrise. Updated once per second. */
    remaining: Duration;
  }
}

export const getNextExpectedSunrise = () => {
  const now = DateTime.now();
  return now.set({ minute: 0, second: 0, millisecond: 0 }).plus({ hour: 1 });
};
