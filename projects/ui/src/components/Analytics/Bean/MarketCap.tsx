import React from 'react';
import { tickFormatUSD } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { Season, SeasonalMarketCapDocument } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason'; 

import { FC } from '~/types';

const getValue = (season: Season) => parseFloat(season.marketCap);
const formatValue = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Market Cap',
  titleTooltip: 'The USD value of the total Bean supply at the end of every Season.',
  gap: 0.25,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatUSD
};

const MarketCap: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => {
  const season = useSeason();
  return (
    <SeasonPlot
      document={SeasonalMarketCapDocument}
      height={height}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
    />
  );
};

export default MarketCap;
