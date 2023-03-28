import React from 'react';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalPodsDocument, SeasonalPodsQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '../../../util';
import { BEAN } from '../../../constants/tokens';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import { tickFormatTruncated } from '~/components/Analytics/formatters'; 

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalPodsQuery>) => toTokenUnitsBN(season.unharvestablePods, BEAN[1].decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Pods',
  titleTooltip: 'The total number of Pods at the end of each Season.',
  gap: 0.5,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatTruncated
};

const Pods: FC<{height?: SeasonPlotBaseProps['height']}> = ({ height }) => (
  <SeasonPlot<SeasonalPodsQuery>
    height={height}
    document={SeasonalPodsDocument}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={statProps}
    LineChartProps={lineChartProps}
  />
);

export default Pods;
