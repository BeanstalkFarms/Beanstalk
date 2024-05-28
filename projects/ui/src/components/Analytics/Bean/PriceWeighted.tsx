import React from 'react';
import { tickFormatBeanPrice } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import {
  SeasonalWeightedPriceDocument,
  SeasonalWeightedPriceQuery,
} from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalWeightedPriceQuery>) =>
  parseFloat(season.twaPrice);
const formatValue = (value: number) => `$${value.toFixed(4)}`;
const statProps = {
  title: 'TWA Bean Price',
  titleTooltip:
    'The cumulative liquidity and time weighted average USD price of 1 Bean at the beginning of every Season. Values during liquidity migrations are omitted. Pre-exploit values include the TWA price in all pools on the Deposit Whitelist.',
  gap: 0.25,
};

const queryConfig = {
  variables: { season_gte: 1 },
  context: { subgraph: 'bean' },
};

const lineChartProps: Partial<LineChartProps> = {
  pegLine: true,
  yTickFormat: tickFormatBeanPrice,
};

const PriceWeighted: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => (
  <SeasonPlot<SeasonalWeightedPriceQuery>
    document={SeasonalWeightedPriceDocument}
    height={height}
    getValue={getValue}
    formatValue={formatValue}
    queryConfig={queryConfig}
    StatProps={statProps}
    LineChartProps={lineChartProps}
    dateKey="timestamp"
  />
);

export default PriceWeighted;
