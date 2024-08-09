import { Time, Range } from 'lightweight-charts';
import { useState } from 'react';

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

const getTimePeriodState = (prefix: string) => {
  const storedSetting1 = localStorage.getItem(`${prefix}TimePeriod`);
  return storedSetting1 ? JSON.parse(storedSetting1) : undefined;
};

const useChartTimePeriodState = (
  storageKeyPrefix: string = 'advancedChart'
) => {
  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(
    getTimePeriodState(storageKeyPrefix)
  );

  return [timePeriod, setTimePeriod] as const;
};

export default useChartTimePeriodState;
