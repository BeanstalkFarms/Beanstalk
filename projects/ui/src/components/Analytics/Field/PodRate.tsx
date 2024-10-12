import React from 'react';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import {
  SeasonalPodRateDocument,
  SeasonalPodRateQuery,
} from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import usePodRate from '~/hooks/beanstalk/usePodRate';
import {
  SeasonsQueryDynamicConfig,
  SnapshotData,
} from '~/hooks/beanstalk/useSeasonsQuery';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import { tickFormatPercentage } from '~/components/Analytics/formatters';

import { FC } from '~/types';
import { BEANSTALK_ADDRESSES, RESEED_SEASON } from '~/constants';

const getValue = (season: SnapshotData<SeasonalPodRateQuery>) =>
  parseFloat(season.podRate) * 100;
const formatValue = (value: number) => `${value.toFixed(2)}%`;
const statProps = {
  title: 'Pod Rate',
  titleTooltip:
    'The ratio of Unharvestable Pods per Bean, displayed as a percentage, at the beginning of every Season. The Pod Rate is used by Beanstalk as a proxy for its health.',
  gap: 0.25,
  sx: { ml: 0 },
};
const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage,
};

const queryConfig: SeasonsQueryDynamicConfig = (subgraph: 'l1' | 'l2') => {
  if (subgraph === 'l1') {
    return {
      variables: { season_gte: 1, field: BEANSTALK_ADDRESSES[1].toLowerCase() },
      context: { subgraph: 'beanstalk_eth' },
    };
  }
  return {
    variables: {
      season_gte: RESEED_SEASON,
      field: BEANSTALK_ADDRESSES[42161].toLowerCase(),
    },
    context: { subgraph: 'beanstalk' },
  };
};

const PodRate: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const podRate = usePodRate();
  const season = useSeason();
  return (
    <SeasonPlot<SeasonalPodRateQuery>
      height={height}
      document={SeasonalPodRateDocument}
      defaultValue={podRate?.gt(0) ? podRate.toNumber() : 0}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      queryConfig={queryConfig}
      name="podRate"
    />
  );
};

export default PodRate;
