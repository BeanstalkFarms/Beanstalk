import React, { useCallback, useMemo } from 'react';
import { DocumentNode } from 'graphql';
import { QueryOptions } from '@apollo/client';
import { StatProps } from '~/components/Common/Stat';
import useSeasonsQuery, {
  MinimumViableSnapshotQuery,
} from '~/hooks/beanstalk/useSeasonsQuery';
import useGenerateChartSeries from '~/hooks/beanstalk/useGenerateChartSeries';
import {
  BaseChartProps,
  BaseDataPoint,
} from '~/components/Common/Charts/ChartPropProvider';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import BaseSeasonPlot, {
  QueryData,
} from '~/components/Common/Charts/BaseSeasonPlot';
import { DynamicSGQueryOption } from '~/util/Graph';

export const defaultValueFormatter = (value: number) => `$${value.toFixed(4)}`;

export type SeasonDataPoint = BaseDataPoint;

export type SeasonPlotBaseProps = {
  /** */
  document: DocumentNode;
  /**
   * The value displayed when the chart isn't being hovered.
   * If not provided, uses the `value` of the last data point if available,
   * otherwise returns 0.
   */
  defaultValue?: number;
  /**
   * The season displayed when the chart isn't being hovered.
   * If not provided, uses the `season` of the last data point if available,
   * otherwise returns 0.
   */
  defaultSeason?: number;
  /**
   * The date displayed when the chart isn't being hovered.
   * If not provided, uses the `date` of the last data point if available,
   * otherwise returns the current timestamp.
   */
  defaultDate?: Date;
  /**
   * Height applied to the chart range. Can be a fixed
   * pixel number or a percent if the parent element has a constrained height.
   */
  height?: number | string;
  /** True if this plot should be a StackedAreaChard */
  stackedArea?: boolean;
  /**
   * Name of query. For React-Query query key.
   */
  name: string;
};

type SeasonPlotFinalProps<T extends MinimumViableSnapshotQuery> =
  SeasonPlotBaseProps & {
    queryConfig?: Partial<QueryOptions> | DynamicSGQueryOption;
    cacheDocument?: DocumentNode;
    cacheWhere?: string;
    /**
     * Which value to display from the Season object
     */
    getValue: (snapshot: T['seasons'][number]) => number;
    /**
     * Format the value from number -> string
     */
    formatValue?: (value: number) => string | JSX.Element;
    dateKey?: 'timestamp' | 'createdAt';
    StatProps: Omit<StatProps, 'amount' | 'subtitle'>;
    LineChartProps?: Pick<BaseChartProps, 'curve' | 'isTWAP' | 'pegLine'>;
    statsRowFullWidth?: boolean;
    fetchType?: 'l1-only' | 'l2-only' | 'both';
  };

/**
 * Wraps {BaseSeasonPlot} with data.
 */
function SeasonPlot<T extends MinimumViableSnapshotQuery>({
  document,
  queryConfig,
  cacheDocument,
  cacheWhere,
  defaultValue: _defaultValue,
  defaultSeason: _defaultSeason,
  defaultDate: _defaultDate,
  getValue,
  formatValue = defaultValueFormatter,
  height = '175px',
  StatProps: statProps, // renamed to prevent type collision
  LineChartProps,
  dateKey = 'createdAt',
  stackedArea,
  statsRowFullWidth,
  fetchType = 'both',
  name,
}: SeasonPlotFinalProps<T>) {
  const timeTabParams = useTimeTabState();
  const getDisplayValue = useCallback((v?: BaseDataPoint[]) => {
    if (!v?.length) return 0;
    const curr = v[0];
    return curr && 'value' in curr ? curr.value : 0;
  }, []);

  const seasonsQuery = useSeasonsQuery<T>(
    name,
    { document, queryConfig },
    cacheDocument ? { document: cacheDocument, where: cacheWhere } : null,
    timeTabParams[0][1],
    fetchType
  );

  const queryParams = useMemo(
    () => [{ query: seasonsQuery, getValue, key: 'value' }],
    [seasonsQuery, getValue]
  );

  const queryData: QueryData = useGenerateChartSeries(
    queryParams,
    timeTabParams[0],
    dateKey,
    stackedArea
  );

  return (
    <BaseSeasonPlot
      queryData={queryData}
      height={height}
      StatProps={statProps}
      timeTabParams={timeTabParams}
      stackedArea={stackedArea}
      formatValue={formatValue}
      ChartProps={{
        getDisplayValue: getDisplayValue,
        tooltip: false,
        ...LineChartProps,
      }}
      statsRowFullWidth={statsRowFullWidth}
    />
  );
}

export default SeasonPlot;
