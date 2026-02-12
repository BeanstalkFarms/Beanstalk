import React from 'react';
import { tickFormatUSD } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { Season } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';
import { subgraphQueryConfigs } from '~/util/Graph';

const getValue = (season: Season) => parseFloat(season.marketCap);
const formatValue = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Market Cap',
  titleTooltip:
    'The USD value of the Bean supply at the beginning of every Season.',
  gap: 0.25,
};
const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatUSD,
};

const MarketCap: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const season = useSeason();
  return (
    <SeasonPlot
      height={height}
      document={subgraphQueryConfigs.marketCapBEAN.document}
      queryConfig={subgraphQueryConfigs.marketCapBEAN.queryOptions}
      cacheDocument={subgraphQueryConfigs.cachedMarketCapBEAN.document}
      cacheWhere={subgraphQueryConfigs.cachedMarketCapBEAN.where}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      name="seasonalMarketCap"
    />
  );
};

export default MarketCap;
