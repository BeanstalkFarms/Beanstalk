import React from 'react';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalSeedsDocument, SeasonalSeedsQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '~/util';
import { SEEDS } from '~/constants/tokens';
import { tickFormatTruncated } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart'; 

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalSeedsQuery>) => toTokenUnitsBN(season.seeds, SEEDS.decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Seeds',
  titleTooltip: 'The total number of Seeds at the end of each Season.',
  gap: 0.5,
};
const queryConfig = {
  variables: {
    season_gt: 6073,
  }
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatTruncated
};

const Seeds: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => (
  <SeasonPlot<SeasonalSeedsQuery>
    height={height}
    document={SeasonalSeedsDocument}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={statProps}
    LineChartProps={lineChartProps}
    queryConfig={queryConfig}
  />
);

export default Seeds;
