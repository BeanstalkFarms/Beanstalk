import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo } from 'react';
import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { SILO_WHITELIST } from '~/constants/tokens';
import { SeasonalApyDocument, SeasonalApyQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const formatValue = (value: number) => `${value.toFixed(2)}%`;
const queryConfig = {
  variables: {
    season_gt: 6074,
    token: '',
  },
};
const lineChartProps: Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage,
};
const metricToKey = {
  Bean: SILO_WHITELIST[0][1].address,
  Bean3Curve: SILO_WHITELIST[1][1].address,
  BeanETHWell: SILO_WHITELIST[2][1].address,
  UnripeBean: SILO_WHITELIST[3][1].address,
  UnripeBeanETH: SILO_WHITELIST[4][1].address,
};

const metricTitles = {
  Bean: 'Bean 30D vAPY',
  Bean3Curve: 'BEAN3CRV 30D vAPY',
  BeanETHWell: 'BEANETH 30D vAPY',
  UnripeBean: 'urBEAN 30D vAPY',
  UnripeBeanETH: 'urBEANETH 30D vAPY',
};

const APY: FC<{
  height?: SeasonPlotBaseProps['height'];
  metric: keyof typeof metricToKey;
}> = ({ height, metric }) => (
  <SeasonPlot<SeasonalApyQuery>
    height={height}
    document={SeasonalApyDocument}
    getValue={useCallback(
      (season: SnapshotData<SeasonalApyQuery>) =>
        new BigNumber(season.beanAPY).times(100).toNumber(),
      []
    )}
    formatValue={formatValue}
    StatProps={useMemo(
      () => ({
        title: metricTitles[metric],
        // FIXME: identical to SiloAssetApyChip
        titleTooltip:
          'The Variable Bean APY uses a moving average of Beans earned by Stalkholders during recent Seasons to estimate a future rate of return, accounting for Stalk growth.',
        gap: 0.5,
      }),
      [metric]
    )}
    LineChartProps={lineChartProps}
    queryConfig={useMemo(() => {
      const tokenAddress = metricToKey[metric];
      return {
        ...queryConfig,
        variables: {
          ...queryConfig.variables,
          token: tokenAddress,
        },
      };
    }, [metric])}
  />
);

export default APY;
