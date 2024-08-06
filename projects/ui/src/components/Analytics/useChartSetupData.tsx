
import React, { useMemo } from 'react';
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
  SeasonalStalkDocument,
  SeasonalSupplyDocument,
  SeasonalTemperatureDocument,
  SeasonalTotalSowersDocument,
  SeasonalVolumeDocument,
  SeasonalWeightedDeltaBDocument,
  SeasonalWeightedPriceDocument,
} from '~/generated/graphql';
import useSdk from '~/hooks/sdk';
import { formatUnits } from 'viem';
import { BEAN_CRV3_V1_LP, BEAN_LUSD_LP } from '~/constants/tokens';
import { DocumentNode } from 'graphql';
import { OperationVariables, QueryOptions } from '@apollo/client';
import { Typography } from '@mui/material';
import {
  tickFormatBeanAmount,
  tickFormatBeanPrice,
  tickFormatPercentage,
  tickFormatTruncated,
  tickFormatUSD,
  valueFormatBeanAmount,
} from './formatters';

type ChartSetupBase = {
  /**
   * Name of this chart. Mainly used in the Select Dialog and the chips that show which charts
   * are currently selected, therefore ideally it should be short and to the point.
   */
  name: string;
  /**
   * Title shown in the actual chart after the user
   * makes their selection.
   */
  tooltipTitle: string;
  /**
   * Text description shown when user hovers the tooltip icon next to the tooltip title.
   */
  tooltipHoverText: string | JSX.Element;
  /**
   * Short description shown in the Select Dialog.
   */
  shortDescription: string;
  /**
   * The field in the GraphQL request that corresponds to a timestamp. Usually "createdAt" or "timestamp".
   */
  timeScaleKey: string;
  /**
   * The field in the GraphQL request that corresponds to the value that will be charted.
   */
  priceScaleKey: string;
  /**
   * The Apollo document of the GraphQL query.
   */
  document: DocumentNode;
  /**
   * The entity that contains the data in your GraphQL request. Usually "seasons".
   */
  documentEntity: string;
  /**
   * Short identifier for the output of this chart. Lightweight Charts only supports
   * two price scales, so we use this to group charts that have similar
   * outputs in the same price scale.
   */
  valueAxisType: string;
  /**
   * Sets up things like variables and context for the GraphQL queries.
   */
  queryConfig: Partial<QueryOptions<OperationVariables, any>> | undefined;
  /**
   * Formats the raw output from the query into a number for Lightweight Charts.
   */
  valueFormatter: (v: string) => number | undefined;
  /**
   * Formats the number used by Lightweight Charts into a string that's shown at the top
   * of the chart.
   */
  tickFormatter: (v: number) => string | undefined;
  /**
   * Formats the number used by Lightweight Charts into a string for the
   * price scales.
   */
  shortTickFormatter: (v: number) => string | undefined;
};

type ChartSetup = ChartSetupBase & {
  /**
   * Used in the "Bean/Field/Silo" buttons in the Select Dialog to allow
   * the user to quickly filter the available charts.
   */
  type: string;
  /**
   * Id of this chart in the chart data array.
   */
  index: number;
};

export function useChartSetupData() {
  const sdk = useSdk();

  return useMemo(() => {
    const beanstalkAddress = sdk.addresses.BEANSTALK.MAINNET;
    const stalk = sdk.tokens.STALK;

    const depositedTokensToChart = [
      sdk.tokens.BEAN,
      sdk.tokens.BEAN_CRV3_LP,
      sdk.tokens.BEAN_ETH_WELL_LP,
      sdk.tokens.BEAN_WSTETH_WELL_LP,
      sdk.tokens.UNRIPE_BEAN,
      sdk.tokens.UNRIPE_BEAN_WSTETH,
    ];

    const lpTokensToChart = [
      sdk.tokens.BEAN_CRV3_LP,
      sdk.tokens.BEAN_ETH_WELL_LP,
      sdk.tokens.BEAN_WSTETH_WELL_LP,
      sdk.tokens.BEAN_ETH_UNIV2_LP,
      BEAN_LUSD_LP[1],
      BEAN_CRV3_V1_LP[1],
    ];

    const lpCharts: ChartSetupBase[] = [];
    const depositCharts: ChartSetupBase[] = [];
    const apyCharts: ChartSetupBase[] = [];

    depositedTokensToChart.forEach((token) => {
      const depositedChart: ChartSetupBase = {
        name: `Deposited ${token.symbol}`,
        tooltipTitle: `Total Deposited ${token.symbol}`,
        tooltipHoverText: `The total number of Deposited ${
          token.symbol === 'BEAN'
            ? 'Beans'
            : token.symbol === 'urBEAN'
              ? 'Unripe Beans'
              : `${token.name}`
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
        valueAxisType: token.isUnripe
          ? 'depositedUnripeAmount'
          : 'depositedAmount',
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
        shortTickFormatter: tickFormatTruncated,
      };
      const apyChart: ChartSetupBase = {
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
        shortTickFormatter: tickFormatPercentage,
      };

      depositCharts.push(depositedChart);
      apyCharts.push(apyChart);
    });

    lpTokensToChart.forEach((token) => {
      const tokenSymbol =
        token.symbol === 'BEAN:ETH' ? 'Old BEAN:ETH' : token.symbol;
      const lpChart: ChartSetupBase = {
        name: `${tokenSymbol} Liquidity`,
        tooltipTitle: `${tokenSymbol} Liquidity`,
        tooltipHoverText: `The total USD value of ${tokenSymbol} in liquidity pools on the Minting Whitelist.`,
        shortDescription: `${tokenSymbol} Liquidity.`,
        timeScaleKey: 'updatedAt',
        priceScaleKey: 'liquidityUSD',
        document: SeasonalLiquidityPerPoolDocument,
        documentEntity: 'seasons',
        valueAxisType: 'usdLiquidity',
        queryConfig: {
          variables: { pool: token.address },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
        shortTickFormatter: tickFormatUSD,
      };

      lpCharts.push(lpChart);
    });

    const output: ChartSetup[] = [];
    let dataIndex = 0;

    const beanCharts: ChartSetupBase[] = [
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
        shortTickFormatter: tickFormatBeanPrice,
      },
      {
        name: 'Volume',
        tooltipTitle: 'Volume',
        tooltipHoverText:
          'The total USD volume in liquidity pools on the Minting Whitelist.',
        shortDescription: 'The total USD volume in liquidity pools.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'deltaVolumeUSD',
        document: SeasonalVolumeDocument,
        documentEntity: 'seasons',
        valueAxisType: 'volume',
        queryConfig: {
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
        shortTickFormatter: tickFormatUSD,
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
        valueAxisType: 'usdLiquidity',
        queryConfig: {
          variables: { season_gt: 1 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
        shortTickFormatter: tickFormatUSD,
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
        valueAxisType: 'marketCap',
        document: SeasonalMarketCapDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatUSD,
        shortTickFormatter: tickFormatUSD,
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
        shortTickFormatter: tickFormatTruncated,
      },
      {
        name: 'Crosses',
        tooltipTitle: 'Peg Crosses',
        tooltipHoverText:
          'The total number of times Bean has crossed its peg at the beginning of every Season.',
        shortDescription: 'The total number of times Bean has crossed its peg.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'crosses',
        valueAxisType: 'pegCrosses',
        document: SeasonalCrossesDocument,
        documentEntity: 'seasons',
        queryConfig: {
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatBeanAmount,
        shortTickFormatter: tickFormatBeanAmount,
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
        shortTickFormatter: tickFormatBeanAmount,
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
        shortTickFormatter: tickFormatBeanAmount,
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
        shortTickFormatter: tickFormatBeanPrice,
      },
      {
        name: 'Liquidity to Supply Ratio',
        tooltipTitle: 'Liquidity to Supply Ratio',
        tooltipHoverText: (
          <Typography component="span">
            <Typography component="span">
              The Liquidity to Supply Ratio (L2SR) represents the Beanstalk
              liquidity level relative to the Bean supply. The L2SR is a useful
              indicator of Beanstalk&apos;s health.
            </Typography>
            <Typography component="ul">
              <Typography component="li" ml={-2} mt={1}>
                Liquidity is defined as the sum of the USD values of the
                non-Bean assets in each whitelisted liquidity pool multiplied by
                their respective liquidity weights.
              </Typography>
              <Typography component="li" ml={-2} mt={1}>
                Supply is defined as the total Bean supply minus Locked Beans.
              </Typography>
              <Typography component="li" ml={-2} mt={1}>
                Pre-exploit values include liquidity in pools on the Deposit
                Whitelist.
              </Typography>
            </Typography>
          </Typography>
        ),
        shortDescription:
          'The ratio of Beans in liquidity pools on the Minting Whitelist per Bean, displayed as a percentage.',
        timeScaleKey: 'timestamp',
        priceScaleKey: 'supplyInPegLP',
        valueAxisType: 'L2SR',
        document: LiquiditySupplyRatioDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: { season_gt: 0 },
          context: { subgraph: 'bean' },
        },
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
        shortTickFormatter: tickFormatPercentage,
      },
    ];

    const siloCharts: ChartSetupBase[] = [
      ...depositCharts,
      {
        name: `Stalk`,
        tooltipTitle: `Stalk`,
        tooltipHoverText: `The total number of Stalk at the beginning of every Season.`,
        shortDescription: 'The total number of Stalk.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'stalk',
        valueAxisType: 'stalk',
        document: SeasonalStalkDocument,
        documentEntity: 'seasons',
        queryConfig: {
          variables: {
            season_gt: 6073,
          },
        },
        valueFormatter: (value: any) =>
          Number(formatUnits(value, stalk.decimals)),
        tickFormatter: tickFormatBeanAmount,
        shortTickFormatter: tickFormatTruncated,
      },
      ...apyCharts,
    ];

    const fieldCharts: ChartSetupBase[] = [
      {
        name: 'Real Rate of Return',
        tooltipTitle: 'Real Rate of Return',
        tooltipHoverText:
          'The return for sowing Beans, accounting for Bean price. RRoR = (1 + Temperature) / TWAP.',
        shortDescription:
          'The return for sowing Beans, accounting for Bean price. RRoR = (1 + Temperature) / TWAP.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'realRateOfReturn',
        valueAxisType: 'RRoR',
        document: SeasonalRRoRDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
        shortTickFormatter: tickFormatPercentage,
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
        valueAxisType: 'maxTemp',
        document: SeasonalTemperatureDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: tickFormatPercentage,
        shortTickFormatter: tickFormatPercentage,
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
        shortTickFormatter: tickFormatTruncated,
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
        valueAxisType: 'podRate',
        document: SeasonalPodRateDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v) * 100,
        tickFormatter: tickFormatPercentage,
        shortTickFormatter: tickFormatPercentage,
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
        shortTickFormatter: tickFormatTruncated,
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
        shortTickFormatter: tickFormatTruncated,
      },
      {
        name: 'Total Sowers',
        tooltipTitle: 'Total Sowers',
        tooltipHoverText:
          'The total number of unique Sowers at the beginning of every Season.',
        shortDescription: 'The total number of unique Sowers.',
        timeScaleKey: 'createdAt',
        priceScaleKey: 'numberOfSowers',
        valueAxisType: 'totalSowers',
        document: SeasonalTotalSowersDocument,
        documentEntity: 'seasons',
        queryConfig: undefined,
        valueFormatter: (v: string) => Number(v),
        tickFormatter: (v: number) => v.toFixed(0).toString(),
        shortTickFormatter: (v: number) => v.toFixed(0).toString(),
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
