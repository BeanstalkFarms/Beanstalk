import { subWeeks } from 'date-fns';
import { Time, Range } from 'lightweight-charts';
import { useEffect, useState } from 'react';

export type CalendarTimeRange = Range<Time>;

export type CalendarRangePreset =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '2Y'
  | 'ALL';

// charts default to 1 week
const getWeek = (): Range<Time> => {
  const now = Date.now();

  return {
    from: (subWeeks(now, 1).getTime() / 1000) as Time,
    to: (now / 1000) as Time,
  };
};

const getTimePeriodState = (prefix: string): Range<Time> => {
  const storedSetting = localStorage.getItem(`${prefix}TimePeriod`);
  if (!storedSetting) {
    const week = getWeek();
    localStorage.setItem(`${prefix}TimePeriod`, JSON.stringify(week));
    return week;
  }
  return JSON.parse(storedSetting) as Range<Time>;
};

/**
 * defaults to 1 week
 */
const useChartTimePeriodState = (prefix: string = 'advancedChart') => {
  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(
    getTimePeriodState(prefix)
  );

  useEffect(() => {
    const item = !timePeriod ? getWeek() : timePeriod;
    localStorage.setItem(`${prefix}TimePeriod`, JSON.stringify(item));
  }, [prefix, timePeriod]);

  return [timePeriod, setTimePeriod] as const;
};

export default useChartTimePeriodState;
