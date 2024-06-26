import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import { Box, Button, Card, CircularProgress, Drawer } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseIcon from '@mui/icons-material/Close';
import useToggle from '~/hooks/display/useToggle';
import { apolloClient } from '~/graph/client';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Range, Time } from 'lightweight-charts';
import ChartV2 from './ChartV2';
import DropdownIcon from '../Common/DropdownIcon';
import SelectDialog from './SelectDialog';
import { useChartSetupData } from './useChartSetupData';
import CalendarButton from './CalendarButton';

type QueryData = {
  time: Time,
  value: number,
  customValues: {
    season: number
  };
};

const AdvancedChart: FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const season = useSeason();
  const chartSetupData = useChartSetupData();

  const storedSetting1 = localStorage.getItem('advancedChartTimePeriod');
  const storedTimePeriod = storedSetting1 ? JSON.parse(storedSetting1) : undefined;

  const storedSetting2 = localStorage.getItem('advancedChartSelectedCharts');
  const storedSelectedCharts = storedSetting2 ? JSON.parse(storedSetting2) : undefined;

  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(storedTimePeriod);
  const [selectedCharts, setSelectedCharts] = useState<number[]>(storedSelectedCharts || [0]);

  const [dialogOpen, showDialog, hideDialog] = useToggle();
  const [queryData, setQueryData] = useState<QueryData[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useMemo(() => {
    async function getSeasonData(getAllData?: boolean) {
      const promises: any[] = [];
      const output: any[] = [];
      const timestamps = new Map();

      const maxRetries = 8
      for (let retries = 0; retries < maxRetries; retries += 1) {
        console.debug('[AdvancedChart] Fetching data...');
        try {
          for (let i = 0; i < selectedCharts.length; i += 1) {
            const chartId = selectedCharts[i];
            const queryConfig = chartSetupData[chartId].queryConfig;
            const document = chartSetupData[chartId].document;
            const entity = chartSetupData[chartId].documentEntity;

            const currentSeason = season.toNumber();

            const iterations = getAllData ? Math.ceil(currentSeason / 1000) + 1 : 1;
            for (let j = 0; j < iterations; j += 1) {
              const startSeason = getAllData ? currentSeason - j * 1000 : 999999999;
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
                            Number(seasonData[chartSetupData[chartId].timeScaleKey])
                          );
                        };
                        // Some charts will occasionally return two seasons as having the 
                        // same timestamp, here we ensure we only have one datapoint per timestamp
                        if (timestamps.get(seasonData.season + 1) !== timestamps.get(seasonData.season)
                          && timestamps.get(seasonData.season - 1) !== timestamps.get(seasonData.season)
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
                                season: seasonData.season
                              }
                            };
                          };
                        };
                      };
                    });
                  })
              );
            }
          };
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
          };
        };
      };
    };

    setLoading(true);
    getSeasonData(true);
    setLoading(false);
  }, [chartSetupData, selectedCharts, season]);

  function handleDeselectChart(selectionIndex: number) {
    const newSelection = [...selectedCharts];
    newSelection.splice(selectionIndex, 1);
    setSelectedCharts(newSelection);
    localStorage.setItem('advancedChartSelectedCharts', JSON.stringify(newSelection));
  };

  return (
    <>
      <Box display="flex" flexDirection="row" gap={2}>
        <Card sx={{ position: 'relative', width: '100%', height: '70vh', overflow: 'clip' }}>
          {!isMobile ? (
            <Card
              sx={{
                position: 'absolute',
                left: dialogOpen ? '0%' : '-100%',
                width: 620,
                zIndex: 4,
                height: 'calc(100% + 2px)',
                marginTop: '-1px',
                transition: 'left 0.3s',
                borderRadius: 0,
                borderLeftColor: 'transparent'
              }}
            >
              <SelectDialog
                handleClose={hideDialog}
                selected={selectedCharts}
                setSelected={setSelectedCharts}
                isMobile={isMobile}
              />
            </Card>
          ) : (
            <Drawer anchor="bottom" open={dialogOpen} onClose={hideDialog}>
              <SelectDialog
                handleClose={hideDialog}
                selected={selectedCharts}
                setSelected={setSelectedCharts}
                isMobile={isMobile}
              />
            </Drawer>
          )}
          <Box
            padding={1.5}
            sx={{
              borderBottom: '0.5px',
              borderColor: 'divider',
              borderBottomStyle: 'solid',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!isMobile &&
                selectedCharts.map((selection, index) => (
                  <Button
                    variant="outlined-secondary"
                    color="secondary"
                    size="small"
                    key={`selectedChartsButton${index}`}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'stretch',
                      cursor: 'pointer',
                      border: '0.5px solid',
                      borderColor: 'divider',
                      fontWeight: 'normal',
                      color: 'text.primary',
                      boxSizing: 'border-box',
                      height: '26px',
                      overflow: 'clip',
                      wordBreak: 'break-all',
                      paddingY: 0.25,
                      paddingX: 0.75,
                    }}
                    endIcon={
                      <CloseIcon sx={{ color: 'inherit', marginTop: '0.5px' }} />
                    }
                    onClick={() => handleDeselectChart(index)}
                  >
                    {chartSetupData[selection].name}
                  </Button>
                ))}
              {isMobile && (
                <Button
                  variant="outlined-secondary"
                  color="secondary"
                  size="small"
                  key="selectedChartsButtonMobile"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'stretch',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    fontWeight: 'normal',
                    color: 'text.primary',
                    boxSizing: 'border-box',
                    height: '26px',
                    overflow: 'clip',
                    wordBreak: 'break-all',
                    paddingY: 0.25,
                    paddingX: 0.75,
                  }}
                  endIcon={<DropdownIcon open={false} sx={{ fontSize: 20, marginTop: '0.5px' }} />}
                  onClick={() => showDialog()}
                >
                  {selectedCharts.length === 1
                    ? chartSetupData[selectedCharts[0]].name
                    : `${selectedCharts.length} Selected`}
                </Button>
              )}
              {selectedCharts.length < 5 && !isMobile && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  sx={{
                    fontWeight: 'normal',
                    color: 'primary.main',
                    backgroundColor: 'secondary.main',
                    display: 'inline-flex',
                    flexShrink: 0,
                    alignItems: 'stretch',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    boxSizing: 'border-box',
                    height: '26px',
                    overflow: 'clip',
                    wordBreak: 'break-all',
                    paddingY: 0.25,
                    paddingX: 0.75,
                    '&:hover': {
                      color: 'primary.contrastText',
                    },
                  }}
                  endIcon={<AddRoundedIcon fontSize="small" color="inherit" sx={{ marginTop: '0.5px' }} />}
                  onClick={() => showDialog()}
                >
                  Add Data
                </Button>
              )}
            </Box>
            <Box display="flex" flexDirection="row" gap={1}>
              <CalendarButton setTimePeriod={setTimePeriod} />
            </Box>
          </Box>
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
          ) : 
          error ? (
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
          ) :
          (
            selectedCharts.length > 0 ? (
              <ChartV2
                formattedData={queryData}
                selected={selectedCharts}
                drawPegLine
                timePeriod={timePeriod}
              />
            ) : (
              <Box sx={{display: 'flex', height: '90%', justifyContent: 'center', alignItems: 'center'}}>Click the Add Data button to start charting</Box>
            )
          )}
        </Card>
      </Box>
    </>
  );
};

export default AdvancedChart;
