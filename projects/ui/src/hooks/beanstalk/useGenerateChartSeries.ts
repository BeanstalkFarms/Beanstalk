import { useMemo } from 'react';
import { ApolloError } from '@apollo/client';
import BigNumber from 'bignumber.js';
import { BaseDataPoint } from '../../components/Common/Charts/ChartPropProvider';
import { TimeTabState } from '../../components/Common/Charts/TimeTabs';
import useSeasonsQuery, {  MinimumViableSnapshot, MinimumViableSnapshotQuery, SeasonAggregation } from './useSeasonsQuery';
import { secondsToDate, sortSeasons } from '~/util';

type SeasonData = (Omit<MinimumViableSnapshot, 'id'> & any);

export type SeasonsQueryItem<T extends MinimumViableSnapshotQuery> = {
  /*
   * non-destructured value returned by useSeasonsQuery<T>
   */
  query: ReturnType<typeof useSeasonsQuery<T>>
  /*
   * fn used to get value from query
   */
  getValue: (season: T['seasons'][number]) => number;
  /**
   * key of data
   */
  key?: string;
}

/**
 * merges data from multiple instances of useSeasonsQuery
 * returns data in expected format for stacked area chart K[];
 */
const reduceSeasonsQueries = <T extends MinimumViableSnapshotQuery>(params: SeasonsQueryItem<T>[], keys: string[]) => {
  const seasonsRecord: Record<number, SeasonData> = {};
  params.forEach((param, i) => {
    const { query, getValue } = param;
    const key = keys[i];
    // if no seasons data, skip
    if (!query?.data?.seasons) return;
    query.data.seasons.forEach((s) => {
      // if no season data, skip
      if (!s) return;
      const prev = seasonsRecord[s.season];
      if (!prev) {
        seasonsRecord[s.season] = {
          season: s.season,
          timestamp: s.timestamp,
          [key]: getValue(s)
        };
      } else {
        seasonsRecord[s.season] = {
          ...seasonsRecord[s.season],
          [key]: getValue(s)
        };
      }
    });
  });
  return Object.values(seasonsRecord);
};

/**
 * Combines data from n queries and generates series data for stacked area charts.
 * Returns K[][] such that K = BaseDataPoint and where where K[] is sorted by season in ascending order
 * Note: Although Stacked area charts expect K[] as input, we return K[][] so we can share functions for line and stacked area charts
 */
const generateStackedAreaSeriesData = <T extends MinimumViableSnapshotQuery>(
  params: SeasonsQueryItem<T>[], 
  seasonAggregation: SeasonAggregation, 
  keys: string[],
  dateKey: 'timestamp' | 'createdAt'
) => {
  const seasonsData = reduceSeasonsQueries(params, keys);
  const points: BaseDataPoint[] = [];

  if (seasonAggregation === SeasonAggregation.DAY) {
    const data = seasonsData.reverse();
    const lastIndex = data.length - 1;
    let agg = keys.reduce((acc, _key) => {
      acc[_key] = 0;
      return acc;
    }, {} as { [k: string]: number }); // value aggregator
    let i = 0; // total iterations
    let j = 0; // points averaged into this day
    let d: Date | undefined; // current date for this avg
    let s: number | undefined; // current season for this avg

    const copy = { ...agg }; // copy of agg to reset values in agg after every iteration

    for (let k = lastIndex; k >= 0; k -= 1) {
      const season = data[k];
      if (!season) continue;
      for (const _k of keys) {
        const sd = season[_k];
        if (sd) agg[_k] += sd;
      }
      if (j === 0) {
        d = secondsToDate(season[dateKey]);
        s = season.season as number;
        j += 1;
      } else if (i === lastIndex || j === 24) {
        for (const _k of keys) {
          agg[_k] = new BigNumber(agg[_k]).div(j + 1).toNumber();
        }
        points.push({
          season: s as number,
          date: d as Date,
          ...agg,
        } as BaseDataPoint);
        agg = { ...copy };
        j = 0;
      } else {
        j += 1;
      }
      i += 1;
    }
  } else {
    for (const seasonData of seasonsData) {
      points.push({
        ...seasonData,
        season: seasonData.season as number,
        date: secondsToDate(seasonData[dateKey])
      } as BaseDataPoint);
    }
  }
  
  return [points.sort(sortSeasons)];
};

/**
 * generates series data for line charts
 * Returns K[][] such that K = { season: number; date: Date; value: number } and where K[] is sorted by season in ascending order
 */
const generateSeriesData = <T extends MinimumViableSnapshotQuery>(
  params: SeasonsQueryItem<T>[], 
  seasonAggregation: SeasonAggregation,
  dateKey: 'timestamp' | 'createdAt'
) => {
  const points: BaseDataPoint[][] = params.map(({ query, getValue }) => {
    const _points: BaseDataPoint[] = [];
    const data = query.data;
    if (!data || !data.seasons.length) return [];
    const lastIndex = data.seasons.length - 1;
    if (seasonAggregation === SeasonAggregation.DAY) {
      let v = 0; // value aggregator
      let i = 0; // total iterations
      let j = 0; // points averaged into this day
      let d: Date | undefined; // current date for this avg
      let s: number | undefined; // current season for this avg
      for (let k = lastIndex; k >= 0; k -= 1) {
        const season = data.seasons[k];
        if (!season) continue; // skip empty points
        v += getValue(season);
        if (j === 0) {
          d = secondsToDate(season.createdAt);
          s = season.season as number;
          j += 1;
        } else if (
          i === lastIndex || // last iteration
          j === 24 // full day of data ready
        ) {
          _points.push({
            season: s as number,
            date: d as Date,
            value: new BigNumber(v).div(j + 1).toNumber(),
          } as unknown as BaseDataPoint);
          v = 0;
          j = 0;
        } else {
          j += 1;
        }
        i += 1;
      }
    } else {
      for (const season of data.seasons) {
        if (!season || !season.season) continue;
        _points.push({
          season: season.season as number,
          date: secondsToDate(season[dateKey]),
          value: getValue(season),
        } as unknown as BaseDataPoint);
      }
    }
    return _points.sort(sortSeasons);
  });
  return points;
};

export type ChartSeriesParams = {
  data: BaseDataPoint[][];
  error: ApolloError[] | undefined;
  keys: string[];
  loading: boolean;
  stackedArea?: boolean;
}

/**
 * Generates series data for line & stacked area charts.
 */
const useGenerateChartSeries = <T extends MinimumViableSnapshotQuery>(
  params: SeasonsQueryItem<T>[],
  timeTabState: TimeTabState,
  // whereas the beanstalk subgraph uses 'createdAt', the bean subgraph uses 'timestamp'
  // include param to choose which key to use
  dateKey: 'timestamp' | 'createdAt',
  stackedArea?: boolean,
  
): ChartSeriesParams => {
  const loading = !!(params.find((p) => p.query.loading));

  const error = useMemo(() => {
    const errs = params
      .filter(({ query: q }) => q.error !== undefined)
      .map(({ query: q }) => q.error) as ApolloError[]; 
    return errs.length ? errs : undefined;
  }, [params]);

  const mergeData = useMemo(() => {
    const _keys = params.map((param, i) => param.key ?? i.toString());
    const series = stackedArea 
      ? generateStackedAreaSeriesData(params, timeTabState[0], _keys, dateKey)
      : generateSeriesData(params, timeTabState[0], dateKey);
    return { data: series, keys: _keys };
  }, [params, stackedArea, timeTabState, dateKey]);

  return { ...mergeData, error, loading };
};

export default useGenerateChartSeries;
