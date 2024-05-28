import React from 'react';
import { tickFormatLocale } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { BEAN } from '~/constants/tokens';
import {
  SeasonalWeightedDeltaBDocument,
  SeasonalWeightedDeltaBQuery,
} from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '~/util';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalWeightedDeltaBQuery>) =>
  toTokenUnitsBN(season.twaDeltaB, BEAN[1].decimals).toNumber();
const formatValue = (value: number) =>
  `${value.toLocaleString('en-us', { maximumFractionDigits: 2 })}`;
const statProps = {
  title: 'Cumulative TWA deltaB',
  titleTooltip:
    'The cumulative liquidity and time weighted average shortage of Beans in liquidity pools on the Minting Whitelist at the beginning of every Season. Values during liquidity migrations are omitted. Pre-exploit values include the TWA deltaB in all pools on the Deposit Whitelist.',
  gap: 0.25,
};

const queryConfig = {
  variables: { season_gte: 1 },
  context: { subgraph: 'bean' },
};

const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatLocale,
  horizontalLineNumber: 0,
};

const DeltaBWeighted: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => (
  <SeasonPlot<SeasonalWeightedDeltaBQuery>
    document={SeasonalWeightedDeltaBDocument}
    height={height}
    getValue={getValue}
    formatValue={formatValue}
    queryConfig={queryConfig}
    StatProps={statProps}
    LineChartProps={lineChartProps}
    dateKey="timestamp"
  />
);

export default DeltaBWeighted;
