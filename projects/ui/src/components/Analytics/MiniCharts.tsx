import React from 'react';
import { FC } from '~/types';
import { useSeasonalLiquidityQuery, useSeasonalMarketCapQuery, useSeasonalSupplyQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Box, Card, CircularProgress } from '@mui/material';
import useSdk from '~/hooks/sdk';
import { formatUnits } from 'viem';
import { getFormattedAndExtraData } from './formatters';
import ChartV2 from './ChartV2';
import { useChartSetupData } from './useChartSetupData';

const MiniCharts: FC<{}> = () => {

  const season = useSeason();
  const sdk = useSdk();
  const chartSetupData = useChartSetupData();
  const BEAN = sdk.tokens.BEAN;

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

  const chartsToUse = ['Bean Price', 'Market Cap', 'Supply'];
  const chartIds: number[] = [];
  chartsToUse.forEach((chartName) => {
    const chartId = chartSetupData.findIndex((setupData) => setupData.name === chartName)
    if (chartId > -1) {
     chartIds.push(chartId)
    };
  });

  const { formattedData: supplyFormattedData } = getFormattedAndExtraData(
    supplyData,
    [chartIds[0]],
    chartSetupData
  );
  const { formattedData: marketCapFormattedData } = getFormattedAndExtraData(
    marketCapData,
    [chartIds[1]],
    chartSetupData
  );
  const { formattedData: liquidityFormattedData } = getFormattedAndExtraData(
    liquidityData,
    [chartIds[2]],
    chartSetupData
  );

  const formatBeanValue = (value: any) => Number(formatUnits(value, BEAN.decimals)).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const formatDollarValue = (value: any) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const allFormattedData = [supplyFormattedData, marketCapFormattedData, liquidityFormattedData]
  const loadingComplete = !(loadingLiquidityData && loadingMarketCapData && loadingSupplyData);

  return (
    <>
      <Box display='flex' flexDirection='row' gap={2}>
        {chartIds.map((chart, index) => (
            <Card sx={{ width: '100%', height: 150 }}>
            {loadingComplete ? (
              <ChartV2
                formattedData={allFormattedData[index]}
                selected={[chart]}
                priceFormatter={chartSetupData[chart].valueFormatter}
                size="mini"
                containerHeight={150}
              />
            ) : (
              <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress variant="indeterminate" />
              </Box>
            )}
            </Card>            
          )
        )}
      </Box>
    </>
  );
};

export default MiniCharts;
