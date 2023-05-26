import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import {
  LiquiditySupplyRatioDocument,
  LiquiditySupplyRatioQuery,
} from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FC } from '~/types';

const getValue = (season: LiquiditySupplyRatioQuery['seasons'][number]) =>
  ((season.supplyInPegLP) * 100);
const formatValue = (value: number) =>
  `${value.toFixed(4)}%`;
const statProps = {
  title: 'Liquidity:Supply Ratio',
  titleTooltip:
    `The ratio of Beans in liquidity pools on the Oracle Whitelist per Bean, displayed as a percentage. The Liquidity:Supply Ratio is a useful indicator of Beanstalk's health.`,
  gap: 0.25,
};
const queryConfig = {
  variables: { season_gt: 0 },
  context: { subgraph: 'bean' },
};
const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage,
};

const LiquiditySupplyRatio: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const season = useSeason();
  return (
    <SeasonPlot<LiquiditySupplyRatioQuery>
      document={LiquiditySupplyRatioDocument}
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

export default LiquiditySupplyRatio;
