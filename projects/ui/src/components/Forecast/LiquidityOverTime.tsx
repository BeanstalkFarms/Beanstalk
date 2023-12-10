import React, { useMemo } from 'react';
import { Box, Card, CardProps } from '@mui/material';
import {
  SeasonalLiquidityPerPoolDocument,
} from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';
import useSeasonsQuery from '~/hooks/beanstalk/useSeasonsQuery';
import { BaseDataPoint } from '../Common/Charts/ChartPropProvider';
import useSdk from '~/hooks/sdk';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import BaseSeasonPlot, { QueryData } from '../Common/Charts/BaseSeasonPlot';

/// Setup SeasonPlot
const formatValue = (value: number) => (
  `$${(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
);
const StatProps = {
  title: 'Liquidity',
  titleTooltip: 'The total USD value of tokens in liquidity pools on the Oracle Whitelist at the beginning of every Season.',
  gap: 0.25,
  color: 'primary',
  sx: { ml: 0 },
};

const LiquidityOverTime: FC<{} & CardProps> = ({ sx }) => {

  //
  const sdk = useSdk();
  const timeTabParams = useTimeTabState();
  const season = useSeason();
  
  const getStatValue = <T extends BaseDataPoint>(v?: T[]) => {
    if (!v?.length) return 0;
    const dataPoint = v[0];
    return dataPoint?.value || 0;
  };

  const poolList = [
    sdk.pools.BEAN_CRV3,
    sdk.pools.BEAN_ETH_WELL
  ];

  const queryConfigBeanCrv3 = useMemo(() => ({ 
    variables: { pool: sdk.pools.BEAN_CRV3.address }, 
    context: { subgraph: 'bean' } 
  }), [sdk.pools.BEAN_CRV3.address]);

  const queryConfigBeanEthWell = useMemo(() => ({ 
    variables: { pool: sdk.pools.BEAN_ETH_WELL.address }, 
    context: { subgraph: 'bean' } 
  }), [sdk.pools.BEAN_ETH_WELL.address]);

  const beanCrv3 = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, timeTabParams[0][1], queryConfigBeanCrv3);
  const beanEthWell = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, timeTabParams[0][1], queryConfigBeanEthWell);

  const seasonData = [beanCrv3.data?.seasons, beanEthWell.data?.seasons].flat(Infinity);

  const loading = beanCrv3.loading || beanEthWell.loading;

  const processedSeasons: any[] = [];
  const defaultDataPoint = { 
    season: 0, 
    date: 0, 
    value: 0, 
    [sdk.pools.BEAN_CRV3.address]: 0, 
    [sdk.pools.BEAN_ETH_WELL.address]: 0 
  };

  if (season && !loading && seasonData[0] && seasonData[0].season) {
    const latestSeason = seasonData[0].season;
    seasonData.forEach((dataPoint) => {
      const seasonDiff = latestSeason - dataPoint.season;
      if (!processedSeasons[seasonDiff]) {
        processedSeasons[seasonDiff] = { ...defaultDataPoint };
      };
      processedSeasons[seasonDiff].season = Number(dataPoint.season);
      processedSeasons[seasonDiff].date = new Date(Number(dataPoint.updatedAt) * 1000);
      processedSeasons[seasonDiff][dataPoint.id.slice(0, 42)] = Number(dataPoint.liquidityUSD);
      processedSeasons[seasonDiff].value += Number(dataPoint.liquidityUSD);  
    });
  };
 
  const queryData: QueryData = {
    data: [processedSeasons.reverse()],
    loading: loading,
    keys: poolList.map((pool) => pool.address),
    error: undefined,
  };

  return (
    <Card sx={{ width: '100%', pt: 2, ...sx }}>
      <Box sx={{ position: 'relative' }}>
        <BaseSeasonPlot
          queryData={queryData}
          height={250}
          StatProps={StatProps}
          timeTabParams={timeTabParams}
          formatValue={formatValue}
          stackedArea
          ChartProps={{
            getDisplayValue: getStatValue,
            tooltip: true,
          }}
        />
      </Box>
    </Card>
  );
};

export default LiquidityOverTime;
