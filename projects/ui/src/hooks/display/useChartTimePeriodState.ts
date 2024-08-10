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

const initUseChartTimePeriodState = (prefix: string = 'advancedChart') => {
  const now = Date.now();
  // charts default to 1 week
  const weekData: Range<Time> = {
    from: (subWeeks(now, 1).getTime() / 1000) as Time,
    to: (now / 1000) as Time,
  };
  localStorage.setItem(`${prefix}TimePeriod`, JSON.stringify(weekData));
  localStorage.setItem(`${prefix}Preset`, JSON.stringify('1W'));
  return weekData;
};

/**
 * defaults to 1 week
 */
const useChartTimePeriodState = (prefix: string = 'advancedChart') => {
  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(
    initUseChartTimePeriodState(prefix)
  );

  useEffect(() => {
    initUseChartTimePeriodState(prefix);
  }, [prefix]);

  return [timePeriod, setTimePeriod] as const;
};

export default useChartTimePeriodState;
