import React from 'react';
import { tickFormatLocale } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalTotalSowersDocument, SeasonalTotalSowersQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalTotalSowersQuery>) => season.numberOfSowers;
const formatValue = (value: number) => `${value}`;
const statProps = {
  title: 'Total Sowers',
  titleTooltip: 'The total number of unique Sowers at the end of each Season.',
  gap: 0.25,
  sx: { ml: 0 }
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatLocale
};

const TotalSowers: FC<{height?: SeasonPlotBaseProps['height']}> = ({ height }) => {
  const season  = useSeason();
  return (
    <SeasonPlot<SeasonalTotalSowersQuery>
      height={height}
      document={SeasonalTotalSowersDocument}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
    />
  );
};

export default TotalSowers;
