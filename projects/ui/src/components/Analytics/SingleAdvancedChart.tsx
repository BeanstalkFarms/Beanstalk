import React, { useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Range, Time } from 'lightweight-charts';
import useToggle from '~/hooks/display/useToggle';
import { apolloClient } from '~/graph/client';
import { ChartQueryData } from './AdvancedChart';
import { useChartSetupData } from './useChartSetupData';
import CalendarButton from './CalendarButton';
import ChartV2 from './ChartV2';

const SingleAdvancedChart = ({ chartName }: { chartName: string }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const season = useSeason();
  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(
    undefined
  );
  const [dialogOpen, showDialog, hideDialog] = useToggle();
  const [queryData, setQueryData] = useState<ChartQueryData[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const chartSetupData = useChartSetupData();
  const chartId = chartSetupData.find(
    (_data) => _data.name === chartName
  )?.index;

  // copied & modified from useAdvancedChart.tsx
  // TODO: reconcile the two
  useMemo(() => {
    async function getSeasonData(getAllData?: boolean) {
      const promises: any[] = [];
      const output: any[] = [];
      const timestamps = new Map();

      const maxRetries = 8;
      for (let retries = 0; retries < maxRetries; retries += 1) {
        console.debug('[AdvancedChart] Fetching data...');
        if (chartId === undefined) {
          throw new Error(`Chart ${chartName} could not be found`);
        }
        try {
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
                  fetchPolicy: 'no-cache', // Hitting the network every time is MUCH faster than the cache
                })
                .then((r) => {
                  r.data[entity].forEach((seasonData: any) => {
                    if (seasonData?.season && seasonData.season) {
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
                      // Some charts will occasionally return two seasons as having the
                      // same timestamp, here we ensure we only have one datapoint per timestamp
                      if (
                        timestamps.get(seasonData.season + 1) !==
                          timestamps.get(seasonData.season) &&
                        timestamps.get(seasonData.season - 1) !==
                          timestamps.get(seasonData.season)
                      ) {
                        const formattedTime = timestamps.get(seasonData.season);
                        const formattedValue = chartSetupData[
                          chartId
                        ].valueFormatter(
                          seasonData[chartSetupData[chartId].priceScaleKey]
                        );
                        if (formattedTime > 0) {
                          output[chartId][seasonData.season] = {
                            time: formattedTime,
                            value: formattedValue,
                            customValues: {
                              season: seasonData.season,
                            },
                          };
                        }
                      }
                    }
                  });
                })
            );
          }

          await Promise.all(promises);
          output.forEach((dataSet, index) => {
            output[index] = dataSet.filter(Boolean);
          });
          setQueryData(output);
          console.debug('[AdvancedChart] Fetched data successfully!');
          break;
        } catch (e) {
          console.debug('[AdvancedChart] Failed to fetch data.');
          console.error(e);
          if (retries === maxRetries - 1) {
            setError(true);
          }
        }
      }
    }

    setLoading(true);
    getSeasonData(true);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSetupData, season, chartId]);

  return (
    <Stack position="relative">
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '275px',
          overflow: 'clip',
        }}
      >
        <CalendarButton setTimePeriod={setTimePeriod} />

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
        ) : chartId !== undefined ? (
          <ChartV2
            formattedData={queryData}
            selected={[chartId]}
            drawPegLine
            timePeriod={timePeriod}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              height: '90%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            Chart data will load here
          </Box>
        )}
      </Box>
    </Stack>
  );
};

export default SingleAdvancedChart;
