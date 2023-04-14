import React from 'react';
import { tickFormatUSD } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalLiquidityDocument, SeasonalLiquidityQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';

const getValue = (season: SeasonalLiquidityQuery['seasons'][number]) => parseFloat(season.totalLiquidityUSD);
const formatValue = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const statProps = {
  title: 'Liquidity',
  titleTooltip: 'The USD value of the tokens in the BEAN:3CRV pool at the end of every Season.',
  gap: 0.25,
};
const queryConfig = {
  variables: { season_gt: 6073 },
  context: { subgraph: 'bean' }
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatUSD,
};

const Liquidity: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => {
  const season = useSeason();
  return (
    <SeasonPlot
      document={SeasonalLiquidityDocument}
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

export default Liquidity;
