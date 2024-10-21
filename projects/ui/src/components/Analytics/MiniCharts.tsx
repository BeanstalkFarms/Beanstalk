import React, { useMemo } from 'react';
import { FC } from '~/types';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Box, Card, CircularProgress } from '@mui/material';
import { Time } from 'lightweight-charts';
import { useQueries } from '@tanstack/react-query';
import { fetchAllSeasonData } from '~/util/Graph';
import { RESEED_SEASON } from '~/constants';
import { exists, mayFunctionToValue } from '~/util';
import ChartV2 from './ChartV2';
import { useChartSetupData } from './useChartSetupData';

type QueryData = {
  time: Time;
  value: number;
  customValues: {
    season: number;
  };
};

const chartsToUse = ['Bean Price', 'Market Cap', 'Supply', 'Total Liquidity'];

const MiniCharts: FC<{}> = () => {
  const season = useSeason();
  const chartSetupData = useChartSetupData();

  const selectedCharts: number[] = useMemo(() => {
    const output: number[] = [];
    chartsToUse.forEach((chartName) => {
      const chartId = chartSetupData.findIndex(
        (setupData) => setupData.name === chartName
      );
      if (chartId > -1) {
        output.push(chartId);
      }
    });
    return output;
  }, [chartSetupData]);

  const queries = useQueries({
    queries: selectedCharts.map((chartId) => {
      const params = chartSetupData[chartId];
      const dataFormatter = params.dataFormatter;
      const valueFormatter = params.valueFormatter;
      const priceKey = params.priceScaleKey;

      const timestamps = new Set<number>();

      return {
        queryKey: ['analytics', 'mini', params.id, season.toNumber()],
        queryFn: async () => {
          const allSeasonData = await fetchAllSeasonData(
            params,
            season.toNumber(),
            false
          );
          const output = allSeasonData.map((seasonData) => {
            const time = Number(seasonData[params.timeScaleKey]);
            const data = dataFormatter ? dataFormatter?.(seasonData) : seasonData;
            
            const value = mayFunctionToValue<number>(
              valueFormatter(data[priceKey]),
              seasonData.season <= RESEED_SEASON - 1 ? 'l1' : 'l2'
            );

            const invalidTime = !exists(time) || timestamps.has(time) || time <= 0;
            if (invalidTime || !exists(value)) return undefined;

            timestamps.add(time);

            return {
              time,
              value,
              customValues: {
                season: data.season,
              },
            } as QueryData;
          });
          return [output.filter(Boolean)] as QueryData[][];
        },
        enabled: season.gt(0),
        staleTime: Infinity,
      };
    }),
  });

  return (
    <>
      <Box display="flex" flexDirection="row" gap={2}>
        {selectedCharts.map((chart, index) => (
          <Card
            key={`selectedMiniChart${index}`}
            sx={{ width: '100%', height: '15vh', minHeight: 150 }}
          >
            {!queries?.[index].data?.length || queries[index]?.isLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress variant="indeterminate" />
              </Box>
            ) : queries[index]?.error ? (
              <Box
                sx={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Error fetching data
              </Box>
            ) : (
              <ChartV2
                formattedData={queries[index].data ?? [[]]}
                selected={[chart]}
                size="mini"
              />
            )}
          </Card>
        ))}
      </Box>
    </>
  );
};

export default MiniCharts;
