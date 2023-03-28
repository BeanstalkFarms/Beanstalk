import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo } from 'react';
import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalApyDocument, SeasonalApyQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const formatValue = (value: number) => `${value.toFixed(2)}%`;
const queryConfig = {
  variables: {
    season_gt: 6074,
  }
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage
};
const metricToKey = {
  Bean: 'twoSeedBeanAPY',
  LP: 'fourSeedBeanAPY',
  Stalk: 'twoSeedStalkAPY',
};

const APY: FC<{
  height?: SeasonPlotBaseProps['height'];
  metric: keyof typeof metricToKey
}> = ({ 
  height,
  metric,
}) => (
  <SeasonPlot<SeasonalApyQuery>
    height={height}
    document={SeasonalApyDocument}
    getValue={useCallback((season: SnapshotData<SeasonalApyQuery>) => 
      new BigNumber(season[metricToKey[metric] as keyof typeof season]).times(100).toNumber(), 
      [metric]
    )}
    formatValue={formatValue}
    StatProps={useMemo(() => ({
      title: `Bean vAPY for Deposited ${metric}`,
      // FIXME: identical to SiloAssetApyChip
      titleTooltip: 'The Variable Bean APY uses a moving average of Beans earned by Stalkholders during recent Seasons to estimate a future rate of return, accounting for Stalk growth.',
      gap: 0.5,
    }), [metric])}
    LineChartProps={lineChartProps}
    queryConfig={queryConfig}
  />
);

export default APY;
