import React, { useMemo } from 'react';
import { Box, Card, CardProps } from '@mui/material';
import { SeasonalLiquidityPerPoolDocument } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FC } from '~/types';
import useSeasonsQuery, {
  SeasonRange,
  SeasonsQueryDynamicConfig,
} from '~/hooks/beanstalk/useSeasonsQuery';
import useTimeTabState from '~/hooks/app/useTimeTabState';
import {
  BEAN_CRV3_LP,
  BEAN_CRV3_V1_LP,
  BEAN_ETH_UNIV2_LP,
  BEAN_ETH_WELL_LP,
  BEAN_LUSD_LP,
  BEAN_USDC_WELL_LP,
  BEAN_USDT_WELL_LP,
  BEAN_WBTC_WELL_LP,
  BEAN_WEETH_WELL_LP,
  BEAN_WSTETH_WELL_LP,
} from '~/constants/tokens';
import { ChainConstant, SupportedChainId } from '~/constants';
import {
  BaseDataPoint,
  ChartMultiStyles,
} from '../Common/Charts/ChartPropProvider';
import BaseSeasonPlot, { QueryData } from '../Common/Charts/BaseSeasonPlot';
import { BeanstalkPalette } from '../App/muiTheme';

/// Setup SeasonPlot
const formatValue = (value: number) =>
  `$${(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const StatProps = {
  title: 'Liquidity',
  titleTooltip:
    'The total USD value of tokens in liquidity pools on the Minting Whitelist at the beginning of every Season. Pre-exploit values include liquidity in pools on the Deposit Whitelist.',
  gap: 0.25,
  color: 'primary',
  sx: { ml: 0 },
};

const dyanmicBeanConfig = (token: ChainConstant<{ address: string }>) => {
  const fn: SeasonsQueryDynamicConfig = (subgraph: 'l1' | 'l2') => {
    const chain =
      subgraph === 'l1'
        ? SupportedChainId.ETH_MAINNET
        : SupportedChainId.ARBITRUM_MAINNET;
    const address = token[chain].address;
    const subgraphCtx =
      chain === SupportedChainId.ETH_MAINNET ? 'bean_eth' : 'bean';
    return {
      variables: { pool: address.toLowerCase() },
      context: { subgraph: subgraphCtx },
    };
  };
  return fn;
};

const configs = {
  beanCrv3L1: {
    variables: { pool: BEAN_CRV3_LP[1].address },
    context: { subgraph: 'bean_eth' },
  },
  beanETHOld: {
    variables: { pool: BEAN_ETH_UNIV2_LP[1].address },
    context: { subgraph: 'bean_eth' },
  },
  beanLusdOld: {
    variables: { pool: BEAN_LUSD_LP[1].address },
    context: { subgraph: 'bean_eth' },
  },
  beanCrv3Old: {
    variables: { pool: BEAN_CRV3_V1_LP[1].address },
    context: { subgraph: 'bean_eth' },
  },
  beanWstETH: dyanmicBeanConfig(BEAN_WSTETH_WELL_LP),
  beanETH: dyanmicBeanConfig(BEAN_ETH_WELL_LP),
  beanWeETH: {
    variables: {
      pool: BEAN_WEETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET].address,
    },
    context: { subgraph: 'bean' },
  },
  beanWBTC: {
    variables: {
      pool: BEAN_WBTC_WELL_LP[SupportedChainId.ARBITRUM_MAINNET].address,
    },
    context: { subgraph: 'bean' },
  },
  beanUSDC: {
    variables: {
      pool: BEAN_USDC_WELL_LP[SupportedChainId.ARBITRUM_MAINNET].address,
    },
    context: { subgraph: 'bean' },
  },
  beanUSDT: {
    variables: {
      pool: BEAN_USDT_WELL_LP[SupportedChainId.ARBITRUM_MAINNET].address,
    },
    context: { subgraph: 'bean' },
  },
};

const BEAN_CRV3 = BEAN_CRV3_LP[1];
const BEAN_ETH_WELL = BEAN_ETH_WELL_LP[1];
const BEAN_ETH_UNIV2 = BEAN_ETH_UNIV2_LP[1];
const BEAN_LUSD_LP_V1 = BEAN_LUSD_LP[1];
const BEAN_CRV3_V1 = BEAN_CRV3_V1_LP[1];
const BEAN_WSTETH_WELL = BEAN_WSTETH_WELL_LP[1];
const BEAN_WSTETH_WELL_L2 =
  BEAN_WSTETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];
const BEAN_ETH_WELL_L2 = BEAN_ETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];
const BEAN_WBTC_WELL = BEAN_ETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];
const BEAN_WEETH_WELL = BEAN_WEETH_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];
const BEAN_USDC_WELL = BEAN_USDC_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];
const BEAN_USDT_WELL = BEAN_USDT_WELL_LP[SupportedChainId.ARBITRUM_MAINNET];

const poolList = [
  BEAN_WSTETH_WELL,
  BEAN_WSTETH_WELL_L2,
  BEAN_ETH_WELL,
  BEAN_ETH_WELL_L2,
  BEAN_WBTC_WELL,
  BEAN_WEETH_WELL,
  BEAN_USDC_WELL,
  BEAN_USDT_WELL,
  BEAN_CRV3,
  BEAN_ETH_UNIV2,
  BEAN_LUSD_LP_V1,
  BEAN_CRV3_V1,
];

// Order must be the same as poolList!
const chartStyle: ChartMultiStyles = {
  [BEAN_WSTETH_WELL.address]: {
    stroke: BeanstalkPalette.logoGreen,
    fillPrimary: BeanstalkPalette.lightGreen,
  },
  [BEAN_WSTETH_WELL_L2.address]: {
    stroke: BeanstalkPalette.logoGreen,
    fillPrimary: BeanstalkPalette.lightGreen,
  },
  [BEAN_ETH_WELL.address]: {
    stroke: BeanstalkPalette.theme.spring.beanstalkGreen,
    fillPrimary: BeanstalkPalette.theme.spring.washedGreen,
  },
  [BEAN_WBTC_WELL.address]: {
    stroke: BeanstalkPalette.warningYellow,
    fillPrimary: BeanstalkPalette.yellow,
  },
  [BEAN_WEETH_WELL.address]: {
    stroke: BeanstalkPalette.theme.spring.chart.purple,
    fillPrimary: BeanstalkPalette.theme.spring.chart.purpleLight,
  },
  [BEAN_USDC_WELL.address]: {
    stroke: BeanstalkPalette.theme.spring.chart.blue,
    fillPrimary: BeanstalkPalette.theme.spring.chart.blueLight,
  },
  [BEAN_USDT_WELL.address]: {
    stroke: BeanstalkPalette.theme.winter.chart.green,
    fillPrimary: BeanstalkPalette.theme.winter.chart.greenLight,
  },
  [BEAN_ETH_WELL_L2.address]: {
    stroke: BeanstalkPalette.theme.spring.beanstalkGreen,
    fillPrimary: BeanstalkPalette.theme.spring.washedGreen,
  },
  [BEAN_CRV3.address]: {
    stroke: BeanstalkPalette.theme.spring.blue,
    fillPrimary: BeanstalkPalette.theme.spring.lightBlue,
  },
  [BEAN_ETH_UNIV2.address]: {
    stroke: BeanstalkPalette.theme.spring.chart.purple,
    fillPrimary: BeanstalkPalette.theme.spring.chart.purpleLight,
  },
  [BEAN_LUSD_LP_V1.address]: {
    stroke: BeanstalkPalette.theme.spring.grey,
    fillPrimary: BeanstalkPalette.theme.spring.lightishGrey,
  },
  [BEAN_CRV3_V1.address]: {
    stroke: BeanstalkPalette.theme.spring.chart.yellow,
    fillPrimary: BeanstalkPalette.theme.spring.chart.yellowLight,
  },
};

const baseDefaultDataPoint = {
  season: 0,
  date: 0,
  value: 0,
  [BEAN_CRV3.address]: 0,
  [BEAN_ETH_WELL.address]: 0,
  [BEAN_WSTETH_WELL.address]: 0,
  [BEAN_WSTETH_WELL_L2.address]: 0,
  [BEAN_ETH_WELL_L2.address]: 0,
  [BEAN_WEETH_WELL.address]: 0,
  [BEAN_WBTC_WELL.address]: 0,
  [BEAN_USDC_WELL.address]: 0,
  [BEAN_USDT_WELL.address]: 0,
  [BEAN_ETH_UNIV2.address]: 0,
  [BEAN_LUSD_LP_V1.address]: 0,
  [BEAN_CRV3_V1.address]: 0,
};

// Filters non-relevant tokens from the tooltip on a per-season basis
const seasonFilter = {
  [BEAN_ETH_UNIV2.address]: { from: 0, to: 6074 },
  [BEAN_LUSD_LP_V1.address]: { from: 5502, to: 6074 },
  [BEAN_CRV3_V1.address]: { from: 3658, to: 6074 },
  [BEAN_CRV3.address]: { from: 6074, to: Infinity },
  [BEAN_ETH_WELL.address]: { from: 15241, to: Infinity },
  [BEAN_WSTETH_WELL.address]: { from: 23347, to: Infinity },
};

const LiquidityOverTime: FC<{} & CardProps> = ({ sx }) => {
  const timeTabParams = useTimeTabState();
  const season = useSeason();

  const getStatValue = <T extends BaseDataPoint>(v?: T[]) => {
    if (!v?.length) return 0;
    const dataPoint = v[0];
    return dataPoint?.value || 0;
  };

  const beanEthWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanETH,
    'both'
  );
  const beanWstEthWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanWstETH,
    'both'
  );
  const beanWeETHWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanWeETH,
    'l2-only'
  );
  const beanWBTCWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanWBTC,
    'l2-only'
  );
  const beanUSDCWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanUSDC,
    'l2-only'
  );
  const beanUSDTWell = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanUSDT,
    'l2-only'
  );
  const beanCrv3L1 = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    timeTabParams[0][1],
    configs.beanCrv3L1,
    'l1-only'
  );
  const beanEthOld = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    SeasonRange.ALL,
    configs.beanETHOld,
    'l1-only'
  );
  const beanLusdOld = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    SeasonRange.ALL,
    configs.beanLusdOld,
    'l1-only'
  );
  const beanCrv3Old = useSeasonsQuery(
    SeasonalLiquidityPerPoolDocument,
    SeasonRange.ALL,
    configs.beanCrv3Old,
    'l1-only'
  );

  const loading =
    beanCrv3L1.loading ||
    beanEthWell.loading ||
    beanEthOld.loading ||
    beanLusdOld.loading ||
    beanCrv3Old.loading ||
    beanWstEthWell.loading ||
    beanWeETHWell.loading ||
    beanWBTCWell.loading ||
    beanUSDCWell.loading ||
    beanUSDTWell.loading;

  const seasonData = useMemo(() => {
    if (timeTabParams[0][1] === SeasonRange.ALL) {
      return [
        beanCrv3L1.data?.seasons ?? [],
        beanEthWell.data?.seasons ?? [],
        beanWstEthWell.data?.seasons ?? [],
        beanUSDCWell.data?.seasons ?? [],
        beanUSDTWell.data?.seasons ?? [],
        beanWBTCWell.data?.seasons ?? [],
        beanWeETHWell.data?.seasons ?? [],
        beanEthOld.data?.seasons ?? [],
        beanLusdOld.data?.seasons ?? [],
        beanCrv3Old.data?.seasons ?? [],
      ].flat(Infinity);
    }
    return [
      beanCrv3L1.data?.seasons ?? [],
      beanEthWell.data?.seasons ?? [],
      beanWstEthWell.data?.seasons ?? [],
      beanUSDCWell.data?.seasons ?? [],
      beanUSDTWell.data?.seasons ?? [],
      beanWBTCWell.data?.seasons ?? [],
      beanWeETHWell.data?.seasons ?? [],
    ].flat(Infinity);
  }, [
    beanCrv3L1.data?.seasons,
    beanCrv3Old.data?.seasons,
    beanEthOld.data?.seasons,
    beanEthWell.data?.seasons,
    beanLusdOld.data?.seasons,
    beanUSDCWell.data?.seasons,
    beanUSDTWell.data?.seasons,
    beanWBTCWell.data?.seasons,
    beanWeETHWell.data?.seasons,
    beanWstEthWell.data?.seasons,
    timeTabParams,
  ]);

  const queryData = useMemo(() => {
    const processedSeasons: any[] = [];
    const defaultDataPoint = { ...baseDefaultDataPoint };

    if (season && !loading && seasonData[0] && seasonData[0].season) {
      const latestSeason = seasonData[0].season;
      seasonData.forEach((dataPoint) => {
        const seasonDiff = latestSeason - dataPoint.season;
        if (!processedSeasons[seasonDiff]) {
          processedSeasons[seasonDiff] = { ...defaultDataPoint };
        }
        processedSeasons[seasonDiff].season = Number(dataPoint.season);
        processedSeasons[seasonDiff].date = new Date(
          Number(dataPoint.updatedAt) * 1000
        );
        processedSeasons[seasonDiff][dataPoint.id.slice(0, 42)] = Number(
          dataPoint.liquidityUSD
        );
        processedSeasons[seasonDiff].value += Number(dataPoint.liquidityUSD);
      });
    }

    const data: QueryData = {
      data: [processedSeasons.filter(Boolean).reverse()],
      loading: loading,
      keys: poolList.map((pool) => pool.address),
      error: undefined,
    };

    return data;
  }, [loading, season, seasonData]);

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
            stylesConfig: chartStyle,
          }}
        />
      </Box>
    </Card>
  );
};

export default LiquidityOverTime;
