import React from 'react';
import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalRRoRDocument, SeasonalRRoRQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalRRoRQuery>) => parseFloat(season.realRateOfReturn) * 100;
const formatValue = (value: number) => `${value.toFixed(2)}%`;
const statProps = {
  title: 'Real Rate of Return',
  titleTooltip: 'The return for Sowing Beans at the beginning of each Season, accounting for the Bean price. RRoR = (1 + Temperature) / TWAP.',
  gap: 0.5,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage
};

const RRoR: FC<{height?: SeasonPlotBaseProps['height']}> = ({ height }) => (
  <SeasonPlot<SeasonalRRoRQuery>
    height={height}
    document={SeasonalRRoRDocument}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={statProps}
    LineChartProps={lineChartProps}
  />
);

export default RRoR;
