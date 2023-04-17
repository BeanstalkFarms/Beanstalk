import React from 'react';
import { tickFormatUSD } from '~/components/Analytics/formatters';
import { CURVES, LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalVolumeDocument, SeasonalVolumeQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';

const getValue = (season: SeasonalVolumeQuery['seasons'][number]) => parseFloat(season.hourlyVolumeUSD);
const formatValue = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Volume',
  titleTooltip: 'The total volume in the BEAN:3CRV pool in every Season.',
  gap: 0.25,
};
const queryConfig = { context: { subgraph: 'bean' } };
const lineChartProps : Partial<LineChartProps> = {
  curve: CURVES.step,
  yTickFormat: tickFormatUSD,
};

const Volume: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => {
  const season = useSeason();
  return (
    <SeasonPlot
      document={SeasonalVolumeDocument}
      height={height}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      queryConfig={queryConfig}
      dateKey="timestamp"
    />
  );
};

export default Volume;
