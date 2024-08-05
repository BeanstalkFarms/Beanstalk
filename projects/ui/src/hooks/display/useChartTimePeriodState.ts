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

const useChartTimePeriodState = (
  storageKeyPrefix: string = 'advancedChart'
) => {
  const storedSetting1 = localStorage.getItem(`${storageKeyPrefix}TimePeriod`);
  const storedTimePeriod = storedSetting1
    ? JSON.parse(storedSetting1)
    : undefined;

  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(
    storedTimePeriod
  );

  return [timePeriod, setTimePeriod] as const;
};

export default useChartTimePeriodState;
