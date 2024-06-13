import {
  LiquiditySupplyRatioDocument,
  SeasonalApyDocument,
  SeasonalCrossesDocument,
  SeasonalDepositedSiloAssetDocument,
  SeasonalHarvestedPodsDocument,
  SeasonalInstantDeltaBDocument,
  SeasonalInstantPriceDocument,
  SeasonalLiquidityDocument,
  SeasonalLiquidityPerPoolDocument,
  SeasonalMarketCapDocument,
  SeasonalPodRateDocument,
  SeasonalPodsDocument,
  SeasonalRRoRDocument,
  SeasonalSownDocument,
  SeasonalSupplyDocument,
  SeasonalTemperatureDocument,
  SeasonalTotalSowersDocument,
  SeasonalVolumeDocument,
  SeasonalWeightedDeltaBDocument,
  SeasonalWeightedPriceDocument,
} from '~/generated/graphql';
import useSdk from '~/hooks/sdk';
import { useMemo } from 'react';
import { formatUnits } from 'viem';
import {
  tickFormatBeanAmount,
  tickFormatBeanPrice,
  tickFormatPercentage,
  tickFormatUSD,
  valueFormatBeanAmount,
} from './formatters';
import { BEAN_CRV3_V1_LP, BEAN_LUSD_LP } from '~/constants/tokens';

export function useChartSetupData() {
  const sdk = useSdk();

  return useMemo(() => {
    const beanstalkAddress = sdk.addresses.BEANSTALK.MAINNET;
    const stalk = sdk.tokens.STALK;

    const depositedTokensToChart = [
      sdk.tokens.BEAN,
      sdk.tokens.BEAN_CRV3_LP,
      sdk.tokens.BEAN_ETH_WELL_LP,
      sdk.tokens.UNRIPE_BEAN,
      sdk.tokens.UNRIPE_BEAN_WETH,
    ];

    const lpTokensToChart = [
      sdk.tokens.BEAN_CRV3_LP,
      sdk.tokens.BEAN_ETH_WELL_LP,
      sdk.tokens.BEAN_ETH_UNIV2_LP,
      BEAN_LUSD_LP[1],
      BEAN_CRV3_V1_LP[1],
    ];

    const lpCharts: any[] = [];
    const depositCharts: any[] = [];
    const apyCharts: any[] = [];

    depositedTokensToChart.forEach((token) => {
      const depositedChart = {
        name: `Deposited ${token.symbol}`,
        tooltipTitle: `Total Deposited ${token.symbol}`,
        tooltipHoverText: `The total number of Deposited ${
          token.symbol === 'BEAN'
            ? 'Beans.'
            : token.symbol === 'urBEAN'
              ? 'Unripe Beans.'
              : `${token.name}.`
        } at the beginning of every Season.`,
        shortDescription: `The total number of Deposited ${
          token.symbol === 'BEAN'
            ? 'Beans.'
            : token.symbol === 'urBEAN'
              ? 'Unripe Beans.'
              : `${token.name}.`
        }`,
        timeScaleKey: 'createdAt',
        priceScaleKey: 'depositedAmount',
        valueAxisType: `${token.symbol}_amount`,
        document: SeasonalDepositedSiloAssetDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: {
            season_gt: 6073,
            siloAsset: `${beanstalkAddress.toLowerCase()}-${token.address}`,
          },
        },
        valueFormatter: (value: any) =>
          Number(formatUnits(value, token.decimals)),
        tickFormatter: tickFormatBeanAmount,
      };
      const apyChart = {
        name: `${token.symbol} 30D vAPY`,
        tooltipTitle: `${token.symbol} 30D vAPY`,
        tooltipHoverText: `The Variable Bean APY uses a moving average of Beans earned by Stalkholders during recent Seasons to estimate a future rate of return, accounting for Stalk growth.`,
        shortDescription:
          'Average Beans earned by Stalkholders during recent Seasons estimate a future rate of return.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'beanAPY',
        valueAxisType: 'apy',
        document: SeasonalApyDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: {
            season_gt: 6074,
            token: token.address,
          },
        },
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
      };

      depositCharts.push(depositedChart);
      apyCharts.push(apyChart);
    });

    lpTokensToChart.forEach((token) => {
      const lpChart = {
        name: `${token.symbol} Liquidity`,
        tooltipTitle: `${token.symbol} Liquidity`,
        tooltipHoverText: `The total USD value of ${token.symbol} in liquidity pools on the Minting Whitelist.`,
        shortDescription: `${token.symbol} Liquidity`,
        timeScaleKey: 'updatedAt',
        priceScaleKey: 'liquidityUSD',
        document: SeasonalLiquidityPerPoolDocument,
        documentEntity: 'seasons',
        valueAxisType: 'totalUSDValue',
        queryConfig: {
          variables: { pool: token.address }, 
          context: { subgraph: 'bean' }
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,        
      };

      lpCharts.push(lpChart);
    });
    
    const output: any[] = [];
    let dataIndex = 0;

    const beanCharts = [
      {
        name: 'Bean Price',
        tooltipTitle: 'Current Bean Price',
        tooltipHoverText: 'The Current Price of Bean in USD',
        shortDescription: 'The USD price of 1 Bean.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'price',
        document: SeasonalInstantPriceDocument,
        documentEntity: 'seasons',
        valueAxisType: 'BEAN_price',
        queryConfig: {
          variables: { season_gte: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatBeanPrice,
      },
      {
        name: 'Volume',
        tooltipTitle: 'Volume',
        tooltipHoverText: 'The total USD volume in liquidity pools on the Minting Whitelist.',
        shortDescription: 'The total USD volume in liquidity pools.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'deltaVolumeUSD',
        document: SeasonalVolumeDocument,
        documentEntity: 'seasons',
        valueAxisType: 'totalUSDValue',
        queryConfig: {
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
      },
      {
        name: 'Total Liquidity',
        tooltipTitle: 'Liquidity',
        tooltipHoverText:
          'The total USD value of tokens in liquidity pools on the Minting Whitelist at the beginning of every Season. Pre-exploit values include liquidity in pools on the Deposit Whitelist.',
        shortDescription:
          'The total USD value of tokens in liquidity pools on the Minting Whitelist.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'liquidityUSD',
        document: SeasonalLiquidityDocument,
        documentEntity: 'seasons',
        valueAxisType: 'totalUSDValue',
        queryConfig: {
          variables: { season_gt: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
      },
      ...lpCharts,
      {
        name: 'Market Cap',
        tooltipTitle: 'Market Cap',
        tooltipHoverText:
          'The USD value of the Bean supply at the beginning of every Season.',
        shortDescription: 'The USD value of the Bean supply.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'marketCap',
        valueAxisType: 'totalUSDValue',
        document: SeasonalMarketCapDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
      },
      {
        name: 'Supply',
        tooltipTitle: 'Bean Supply',
        tooltipHoverText:
          'The total Bean supply at the beginning of every Season.',
        shortDescription: 'The total Bean supply.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'beans',
        valueAxisType: 'BEAN_amount',
        document: SeasonalSupplyDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'Crosses',
        tooltipTitle: 'Peg Crosses',
        tooltipHoverText:
          'The total number of times Bean has crossed its peg at the beginning of every Season.',
        shortDescription: 'The total number of times Bean has crossed its peg.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'crosses',
        valueAxisType: '',
        document: SeasonalCrossesDocument,
        documentEntity: 'seasons',
        queryConfig: {
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'Inst. deltaB',
        tooltipTitle: 'Cumulative Instantaneous deltaB',
        tooltipHoverText:
          'The cumulative instantaneous shortage of Beans in liquidity pools on the Minting Whitelist at the beginning of every Season. Pre-exploit values include the instantaneous deltaB in all pools on the Deposit Whitelist.',
        shortDescription:
          'The cumulative instantaneous shortage of Beans in liquidity pools on the Minting Whitelist.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'instantaneousDeltaB',
        valueAxisType: 'deltaB',
        document: SeasonalInstantDeltaBDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: { season_gte: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'TWA deltaB',
        tooltipTitle: 'Cumulative TWA deltaB',
        tooltipHoverText:
          'The cumulative liquidity and time weighted average shortage of Beans in liquidity pools on the Minting Whitelist at the beginning of every Season. Values during liquidity migrations are omitted. Pre-exploit values include the TWA deltaB in all pools on the Deposit Whitelist.',
        shortDescription:
          'The time weighted average shortage of Beans in liquidity pools on the Minting Whitelist.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'twaDeltaB',
        valueAxisType: 'deltaB',
        document: SeasonalWeightedDeltaBDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: { season_gte: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'TWA Bean Price',
        tooltipTitle: 'TWA Bean Price',
        tooltipHoverText:
          'The cumulative liquidity and time weighted average USD price of 1 Bean at the beginning of every Season. Values during liquidity migrations are omitted. Pre-exploit values include the TWA price in all pools on the Deposit Whitelist.',
        shortDescription:
          'The cumulative liquidity and time weighted average USD price of 1 Bean.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'twaPrice',
        valueAxisType: 'BEAN_price',
        document: SeasonalWeightedPriceDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: { season_gte: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatBeanPrice,
      },
      {
        name: 'Liquidity to Supply Ratio',
        tooltipTitle: 'Liquidity to Supply Ratio',
        tooltipHoverText: `The ratio of Beans in liquidity pools on the Minting Whitelist per Bean, displayed as a percentage, at the beginning of every Season. The Liquidity to Supply Ratio is a useful indicator of Beanstalk's health. Pre-exploit values include liquidity in pools on the Deposit Whitelist.`,
        shortDescription:
          'The ratio of Beans in liquidity pools on the Minting Whitelist per Bean, displayed as a percentage.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'supplyInPegLP',
        valueAxisType: '',
        document: LiquiditySupplyRatioDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: { season_gt: 0 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
      },
    ];

    const siloCharts = [
      ...depositCharts,
      {
        name: `Stalk`,
        tooltipTitle: `Stalk`,
        tooltipHoverText: `The total number of Stalk at the beginning of every Season.`,
        shortDescription: 'The total number of Stalk.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'stalk',
        valueAxisType: '',
        document: SeasonalDepositedSiloAssetDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: {
            season_gt: 6073,
          },
        },
        valueFormatter: (value: any) =>
          Number(formatUnits(value, stalk.decimals)),
        tickFormatter: tickFormatBeanAmount,
      },
      ...apyCharts,
    ];

    const fieldCharts = [
      {
        name: 'Real Rate of Return',
        tooltipTitle: 'Real Rate of Return',
        tooltipHoverText:
          'The return for sowing Beans, accounting for Bean price. RRoR = (1 + Temperature) / TWAP.',
        shortDescription:
          'The return for sowing Beans, accounting for Bean price. RRoR = (1 + Temperature) / TWAP.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'realRateOfReturn',
        valueAxisType: '',
        document: SeasonalRRoRDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
      },
      {
        name: 'Max Temperature',
        tooltipTitle: 'Max Temperature',
        tooltipHoverText:
          'The maximum interest rate for Sowing Beans every Season.',
        shortDescription:
          'The maximum interest rate for Sowing Beans every Season.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'temperature',
        valueAxisType: '',
        document: SeasonalTemperatureDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatPercentage,
      },
      {
        name: 'Pods',
        tooltipTitle: 'Pods',
        tooltipHoverText:
          'The total number of Unharvestable Pods at the beginning of every Season.',
        shortDescription: 'The total number of Unharvestable Pods.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'unharvestablePods',
        valueAxisType: 'PODS_amount',
        document: SeasonalPodsDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'Pod Rate',
        tooltipTitle: 'Pod Rate',
        tooltipHoverText:
          'The ratio of Unharvestable Pods per Bean, displayed as a percentage, at the beginning of every Season. The Pod Rate is used by Beanstalk as a proxy for its health.',
        shortDescription:
          'The ratio of Unharvestable Pods per Bean, displayed as a percentage.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'podRate',
        valueAxisType: '',
        document: SeasonalPodRateDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
      },
      {
        name: 'Beans Sown',
        tooltipTitle: 'Beans Sown',
        tooltipHoverText:
          'The total number of Beans Sown at the beginning of every Season.',
        shortDescription: 'The total number of Beans Sown.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'sownBeans',
        valueAxisType: 'BEAN_amount',
        document: SeasonalSownDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'Pods Harvested',
        tooltipTitle: 'Pods Harvested',
        tooltipHoverText:
          'The total number of Pods Harvested at the beginning of every Season.',
        shortDescription: 'The total number of Pods Harvested.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'harvestedPods',
        valueAxisType: 'PODS_amount',
        document: SeasonalHarvestedPodsDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: valueFormatBeanAmount,
        tickFormatter: tickFormatBeanAmount,
      },
      {
        name: 'Total Sowers',
        tooltipTitle: 'Total Sowers',
        tooltipHoverText:
          'The total number of unique Sowers at the beginning of every Season.',
        shortDescription: 'The total number of unique Sowers.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'numberOfSowers',
        valueAxisType: '',
        document: SeasonalTotalSowersDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: (v: string) => Number(v),
      },
    ];

    beanCharts.forEach((chartData) => {
      const chartDataToAdd = {
        ...chartData,
        type: 'Bean',
        index: dataIndex,
      };
      output.push(chartDataToAdd);
      dataIndex += 1;
    });

    siloCharts.forEach((chartData) => {
      const chartDataToAdd = {
        ...chartData,
        type: 'Silo',
        index: dataIndex,
      };
      output.push(chartDataToAdd);
      dataIndex += 1;
    });

    fieldCharts.forEach((chartData) => {
      const chartDataToAdd = {
        ...chartData,
        type: 'Field',
        index: dataIndex,
      };
      output.push(chartDataToAdd);
      dataIndex += 1;
    });

    return output;
  }, [sdk]);
}
