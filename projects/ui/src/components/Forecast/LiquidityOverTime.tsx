import React, { useMemo } from 'react';
import { Box, Card, CardProps } from '@mui/material';
import {
  SeasonalLiquidityPerPoolDocument,
} from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FC } from '~/types';
import useSeasonsQuery, { SeasonRange } from '~/hooks/beanstalk/useSeasonsQuery';
import { BaseDataPoint, ChartMultiStyles } from '../Common/Charts/ChartPropProvider';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import BaseSeasonPlot, { QueryData } from '../Common/Charts/BaseSeasonPlot';
import { BEAN_CRV3_LP, BEAN_CRV3_V1_LP, BEAN_ETH_UNIV2_LP, BEAN_ETH_WELL_LP, BEAN_LUSD_LP } from '~/constants/tokens';
import { BeanstalkPalette } from '../App/muiTheme';

/// Setup SeasonPlot
const formatValue = (value: number) => (
  `$${(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
);
const StatProps = {
  title: 'Liquidity',
  titleTooltip: 'The total USD value of tokens in liquidity pools on the Minting Whitelist at the beginning of every Season. Pre-exploit values include liquidity in pools on the Deposit Whitelist.',
  gap: 0.25,
  color: 'primary',
  sx: { ml: 0 },
};

const LiquidityOverTime: FC<{} & CardProps> = ({ sx }) => {

  const timeTabParams = useTimeTabState();
  const season = useSeason();
  
  const getStatValue = <T extends BaseDataPoint>(v?: T[]) => {
    if (!v?.length) return 0;
    const dataPoint = v[0];
    return dataPoint?.value || 0;
  };

  const BEAN_CRV3 = BEAN_CRV3_LP[1];
  const BEAN_ETH_WELL = BEAN_ETH_WELL_LP[1];
  const BEAN_ETH_UNIV2 = BEAN_ETH_UNIV2_LP[1];
  const BEAN_LUSD_LP_V1 = BEAN_LUSD_LP[1];
  const BEAN_CRV3_V1 = BEAN_CRV3_V1_LP[1];

  const poolList = [
    BEAN_CRV3,
    BEAN_ETH_WELL,
    BEAN_ETH_UNIV2,
    BEAN_LUSD_LP_V1,
    BEAN_CRV3_V1,
  ];

  // Order must be the same as poolList!
  const chartStyle: ChartMultiStyles = {
    [BEAN_CRV3.address]: { 
      stroke: BeanstalkPalette.theme.spring.blue, 
      fillPrimary: BeanstalkPalette.theme.spring.lightBlue 
    },
    [BEAN_ETH_WELL.address]: { 
      stroke: BeanstalkPalette.theme.winter.primary, 
      fillPrimary: BeanstalkPalette.theme.winter.primaryHover 
    },
    [BEAN_ETH_UNIV2.address]: { 
      stroke: BeanstalkPalette.theme.spring.chart.purple, 
      fillPrimary: BeanstalkPalette.theme.spring.chart.purpleLight 
    },
    [BEAN_LUSD_LP_V1.address]: { 
      stroke: BeanstalkPalette.theme.spring.grey, 
      fillPrimary: BeanstalkPalette.theme.spring.lightishGrey 
    },
    [BEAN_CRV3_V1.address]: { 
      stroke: BeanstalkPalette.theme.spring.chart.yellow, 
      fillPrimary: BeanstalkPalette.theme.spring.chart.yellowLight 
    },
  };

  // Filters non-relevant tokens from the tooltip on a per-season basis
  const seasonFilter = {
    [BEAN_ETH_UNIV2.address]: { from: 0, to: 6074 },
    [BEAN_LUSD_LP_V1.address]: { from: 5502, to: 6074 },
    [BEAN_CRV3_V1.address]: { from: 3658, to: 6074 },
    [BEAN_CRV3.address]: { from: 6074, to: Infinity },
    [BEAN_ETH_WELL.address]: { from: 15241, to: Infinity },
  };

  const queryConfigBeanCrv3 = useMemo(() => ({ 
    variables: { pool: BEAN_CRV3.address }, 
    context: { subgraph: 'bean' } 
  }), [BEAN_CRV3.address]);

  const queryConfigBeanEthWell = useMemo(() => ({ 
    variables: { pool: BEAN_ETH_WELL.address }, 
    context: { subgraph: 'bean' } 
  }), [BEAN_ETH_WELL.address]);

  const queryConfigBeanEthOld = useMemo(() => ({
    variables: { pool: BEAN_ETH_UNIV2.address }, 
    context: { subgraph: 'bean' }
  }), [BEAN_ETH_UNIV2.address]);

  const queryConfigBeanLusdOld = useMemo(() => ({
    variables: { pool: BEAN_LUSD_LP_V1.address }, 
    context: { subgraph: 'bean' }
  }), [BEAN_LUSD_LP_V1.address]);

  const queryConfigBeanCrv3Old = useMemo(() => ({
    variables: { pool: BEAN_CRV3_V1.address }, 
    context: { subgraph: 'bean' }
  }), [BEAN_CRV3_V1.address]);

  const beanCrv3 = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, timeTabParams[0][1], queryConfigBeanCrv3);
  const beanEthWell = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, timeTabParams[0][1], queryConfigBeanEthWell);
  const beanEthOld = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, SeasonRange.ALL, queryConfigBeanEthOld);
  const beanLusdOld = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, SeasonRange.ALL, queryConfigBeanLusdOld);
  const beanCrv3Old = useSeasonsQuery(SeasonalLiquidityPerPoolDocument, SeasonRange.ALL, queryConfigBeanCrv3Old);

  let seasonData
  if (timeTabParams[0][1] === SeasonRange.ALL) {
    seasonData = [
      beanCrv3.data?.seasons, 
      beanEthWell.data?.seasons, 
      beanEthOld.data?.seasons, 
      beanLusdOld.data?.seasons, 
      beanCrv3Old.data?.seasons
    ].flat(Infinity);
  } else {
    seasonData = [
      beanCrv3.data?.seasons, 
      beanEthWell.data?.seasons,
    ].flat(Infinity);
  };

  const loading =  beanCrv3.loading || beanEthWell.loading || beanEthOld.loading || beanLusdOld.loading || beanCrv3Old.loading;

  const processedSeasons: any[] = [];
  const defaultDataPoint = { 
    season: 0, 
    date: 0, 
    value: 0, 
    [BEAN_CRV3.address]: 0, 
    [BEAN_ETH_WELL.address]: 0,
    [BEAN_ETH_UNIV2.address]: 0,
    [BEAN_LUSD_LP_V1.address]: 0,
    [BEAN_CRV3_V1.address]: 0,
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
    data: [processedSeasons.filter(Boolean).reverse()],
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
            useCustomTokenList: poolList,
            tokenPerSeasonFilter: seasonFilter,
            stylesConfig: chartStyle
          }}
        />
      </Box>
    </Card>
  );
};

export default LiquidityOverTime;
