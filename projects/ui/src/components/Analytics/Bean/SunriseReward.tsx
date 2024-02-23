import React from 'react';
import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { BEAN } from '~/constants/tokens';
import {
    SunriseRewardDocument,
    SunriseRewardQuery,
} from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FC } from '~/types';
import { toTokenUnitsBN } from '~/util';

const getValue = (season: SunriseRewardQuery['seasons'][number]) =>
  (toTokenUnitsBN(season.incentiveBeans, BEAN[1].decimals).toNumber());
const formatValue = (value: number) =>
  `${value.toLocaleString('en-us', { maximumFractionDigits: 2 })}`;
const statProps = {
  title: 'gm Reward',
  titleTooltip:
    `The reward that Beanstalk pays to the caller of the gm function every Season.`,
  gap: 0.25,
};
const queryConfig = {
  variables: { season_gt: 0 },
  context: { subgraph: 'beanstalk' },
};
const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage,
};

const SunriseReward: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const season = useSeason();
  return (
    <SeasonPlot<SunriseRewardQuery>
      document={SunriseRewardDocument}
      height={height}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      queryConfig={queryConfig}
      dateKey="createdAt"
    />
  );
};

export default SunriseReward;
