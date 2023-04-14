import React from 'react';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalStalkDocument, SeasonalStalkQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '~/util';
import { STALK } from '~/constants/tokens';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import { tickFormatTruncated } from '~/components/Analytics/formatters'; 

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalStalkQuery>) => toTokenUnitsBN(season.stalk, STALK.decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Stalk',
  titleTooltip: 'The total number of Stalk at the end of each Season.',
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

const Stalk: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => (
  <SeasonPlot<SeasonalStalkQuery>
    height={height}
    document={SeasonalStalkDocument}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={statProps}
    LineChartProps={lineChartProps}
    queryConfig={queryConfig}
  />
);

export default Stalk;
