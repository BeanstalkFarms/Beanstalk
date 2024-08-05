import { subMonths } from 'date-fns';
import { Time, Range } from 'lightweight-charts';
import React, { useState } from 'react';
import { CalendarPresetRanges } from '~/components/Analytics/CalendarButton';

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

const makeDefaultRange = (
  preset: CalendarRangePreset = '1M'
): CalendarTimeRange => {
  const range = CalendarPresetRanges.find((r) => r.key === preset);
  if (range && range.from && range.to) {
    const from = range.from.valueOf() / 1000;
    const to = range.to.valueOf() / 1000;
    const diff = to - from;
    // console.log({
    //   key: range.key,
    //   from: from,
    //   to: to,
    //   diff: diff,
    //   hourDiff: diff / 60 / 1000
    // })
    return {
      from: (range.from.valueOf() / 1000) as Time,
      to: (range.to.valueOf() / 1000) as Time,
    };
  }
  return {
    from: (subMonths(new Date(), 1).valueOf() / 1000) as Time,
    to: 0 as Time,
  };
};

const useChartTimePeriodState = (
  preset?: CalendarRangePreset
): readonly [
  period: CalendarTimeRange,
  setPeriod: React.Dispatch<React.SetStateAction<CalendarTimeRange>>,
] => {
  const [timePeriod, setTimePeriod] = useState<CalendarTimeRange>(
    makeDefaultRange(preset)
  );

  return [timePeriod, setTimePeriod] as const;
};

export default useChartTimePeriodState;
