import React from 'react';
import { FC } from '~/types';
import { useSeasonalLiquidityQuery, useSeasonalMarketCapQuery, useSeasonalPriceQuery, useSeasonalSupplyQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Box, Card, CircularProgress } from '@mui/material';
import useSdk from '~/hooks/sdk';
import { formatUnits } from 'viem';
import { getFormattedAndExtraData } from './formatters';
import ChartV2 from './ChartV2';

const MiniCharts: FC<{}> = () => {

  const season = useSeason();
  const sdk = useSdk();
  const BEAN = sdk.tokens.BEAN;

  // Subgraph queries
  const { data: priceData, loading: loadingPriceData } = useSeasonalPriceQuery({
    variables: {
      season_lte: season.toNumber() || 0,
      first: 168,
    },
  });
  const { data: supplyData, loading: loadingSupplyData } = useSeasonalSupplyQuery({
    variables: {
      season_lte: season.toNumber() || 0,
      first: 168
    }
  });
  const { data: marketCapData, loading: loadingMarketCapData } = useSeasonalMarketCapQuery({
    variables: {
      season_lte: season.toNumber() || 0,
      first: 168
    }
  });
  const { data: liquidityData, loading: loadingLiquidityData } = useSeasonalLiquidityQuery({
    variables: {
      season_lte: season.toNumber() || 0,
      season_gt: season.toNumber() - 169 || 0,
      first: 168
    },
    context: { subgraph: 'bean' } 
  });

  // Formatting data
  const { formattedData: priceFormattedData } = getFormattedAndExtraData(
    priceData?.seasons.toReversed(),
    'createdAt',
    'price'
  );
  const { formattedData: supplyFormattedData } = getFormattedAndExtraData(
    supplyData?.seasons.toReversed(),
    'createdAt',
    'beans'
  );
  const { formattedData: marketCapFormattedData } = getFormattedAndExtraData(
    marketCapData?.seasons.toReversed(),
    'createdAt',
    'marketCap'
  );
  const { formattedData: liquidityFormattedData } = getFormattedAndExtraData(
    liquidityData?.seasons.toReversed(),
    'timestamp',
    'liquidityUSD'
  );

  const formatBeanValue = (value: any) => Number(formatUnits(value, BEAN.decimals)).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatDollarValue = (value: any) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const loadingComplete = !(loadingPriceData && loadingLiquidityData && loadingMarketCapData && loadingSupplyData);

  return (
    <>
      <Box display='flex' flexDirection='row' gap={2}>
        <Card sx={{ width: '100%', height: 150 }}>
        {loadingComplete ? (
          <ChartV2
            tooltipTitle="Current Bean Price"
            formattedData={priceFormattedData}
            drawPegLine
            size="mini"
            containerHeight={150}
          />
        ) : (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress variant="indeterminate" />
          </Box>
        )}
        </Card>
        <Card sx={{ width: '100%', height: 150 }}>
        {loadingComplete ? (
          <ChartV2
            tooltipTitle="Total Bean Supply"
            formattedData={supplyFormattedData}
            priceFormatter={formatBeanValue}
            size="mini"
            containerHeight={150}
          />
        ) : (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress variant="indeterminate" />
          </Box>
        )}
        </Card>
        <Card sx={{ width: '100%', height: 150 }}>
        {loadingComplete ? (
          <ChartV2
            tooltipTitle="Market Cap"
            formattedData={marketCapFormattedData}
            priceFormatter={formatDollarValue}
            size="mini"
            containerHeight={150}
          />
        ) : (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress variant="indeterminate" />
          </Box>
        )}
        </Card>
        <Card sx={{ width: '100%', height: 150 }}>
        {loadingComplete ? (
          <ChartV2
            tooltipTitle="Liquidity"
            formattedData={liquidityFormattedData}
            priceFormatter={formatDollarValue}
            size="mini"
            containerHeight={150}
          />
        ) : (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress variant="indeterminate" />
          </Box>
        )}
        </Card>
      </Box>
    </>
  );
};

export default MiniCharts;
