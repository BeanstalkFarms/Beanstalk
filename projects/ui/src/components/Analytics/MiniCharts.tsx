import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Box, Card, CircularProgress } from '@mui/material';
import { apolloClient } from '~/graph/client';
import { Time } from 'lightweight-charts';
import ChartV2 from './ChartV2';
import { useChartSetupData } from './useChartSetupData';

type QueryData = {
  time: Time;
  value: number;
  customValues: {
    season: number;
  };
};

const MiniCharts: FC<{}> = () => {
  const season = useSeason();
  const chartSetupData = useChartSetupData();

  const selectedCharts: number[] = useMemo(() => {
    const chartsToUse = [
      'Bean Price',
      'Market Cap',
      'Supply',
      'Total Liquidity',
    ];
    const output: any[] = [];
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

  const [queryData, setQueryData] = useState<QueryData[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useMemo(() => {
    async function getSeasonData(getAllData?: boolean) {
      const promises: any[] = [];
      const output: any[] = [];
      const timestamps = new Map();

      const maxRetries = 8;
      for (let retries = 0; retries < maxRetries; retries += 1) {
        console.debug('[MiniChart] Fetching data...');
        try {
          for (let i = 0; i < selectedCharts.length; i += 1) {
            const chartId = selectedCharts[i];
            const queryConfig = chartSetupData[chartId].queryConfig;
            const document = chartSetupData[chartId].document;
            const entity = chartSetupData[chartId].documentEntity;

            const currentSeason = season.toNumber();

            const iterations = getAllData
              ? Math.ceil(currentSeason / 1000) + 1
              : 1;
            for (let j = 0; j < iterations; j += 1) {
              const startSeason = getAllData
                ? currentSeason - j * 1000
                : 999999999;
              if (startSeason <= 0) continue;
              promises.push(
                apolloClient
                  .query({
                    ...queryConfig,
                    query: document,
                    variables: {
                      ...queryConfig?.variables,
                      first: 1000,
                      season_lte: startSeason,
                    },
                    notifyOnNetworkStatusChange: true,
                    fetchPolicy: 'cache-first',
                  })
                  .then((r) => {
                    r.data[entity].forEach((seasonData: any) => {
                      if (seasonData?.season) {
                        if (!output[chartId]?.length) {
                          output[chartId] = [];
                        }
                        if (!timestamps.has(seasonData.season)) {
                          timestamps.set(
                            seasonData.season,
                            Number(
                              seasonData[chartSetupData[chartId].timeScaleKey]
                            )
                          );
                        }
                        const fmt = chartSetupData[chartId]?.dataFormatter;
                        const _seasonData = fmt?.(seasonData) || seasonData;
                        const formattedTime = timestamps.get(
                          _seasonData.season
                        );
                        const formattedValue = chartSetupData[
                          chartId
                        ].valueFormatter(
                          _seasonData[chartSetupData[chartId].priceScaleKey]
                        );
                        output[chartId][_seasonData.season] = {
                          time: formattedTime,
                          value: formattedValue,
                          customValues: {
                            season: _seasonData.season,
                          },
                        };
                      }
                    });
                  })
              );
            }
          }
          await Promise.all(promises);
          output.forEach((dataSet, index) => {
            output[index] = dataSet.filter(Boolean);
          });
          setQueryData(output);
          console.debug('[MiniChart] Fetched data successfully!');
          break;
        } catch (e) {
          console.debug('[MiniChart] Failed to fetch data');
          console.error(e);
          if (retries === maxRetries - 1) {
            setError(true);
          }
        }
      }
    }

    setLoading(true);
    getSeasonData();
    setLoading(false);
  }, [chartSetupData, selectedCharts, season]);

  return (
    <>
      <Box display="flex" flexDirection="row" gap={2}>
        {selectedCharts.map((chart, index) => (
          <Card
            key={`selectedMiniChart${index}`}
            sx={{ width: '100%', height: '15vh', minHeight: 150 }}
          >
            {loading ? (
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
            ) : error ? (
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
                formattedData={queryData}
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
