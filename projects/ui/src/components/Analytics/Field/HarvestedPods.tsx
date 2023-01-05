import React from 'react';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalHarvestedPodsDocument, SeasonalHarvestedPodsQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '~/util';
import { BEAN } from '~/constants/tokens';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import { tickFormatTruncated } from '~/components/Analytics/formatters'; 

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalHarvestedPodsQuery>) => toTokenUnitsBN(season.harvestedPods, BEAN[1].decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const StatProps = {
  title: 'Harvested Pods',
  titleTooltip: 'The total number of Pods Harvested at the end of each Season.',
  gap: 0.5,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatTruncated
};

const HarvestedPods: FC<{height?: SeasonPlotBaseProps['height']}> = ({ height }) => (
  <SeasonPlot<SeasonalHarvestedPodsQuery>
    height={height}
    document={SeasonalHarvestedPodsDocument}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={StatProps}
    LineChartProps={lineChartProps}
  />
);

export default HarvestedPods;
