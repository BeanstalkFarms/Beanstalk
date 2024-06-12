import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import { Box, Button, Card, CircularProgress, Drawer } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import useToggle from '~/hooks/display/useToggle';
import { apolloClient } from '~/graph/client';
import useSeason from '~/hooks/beanstalk/useSeason';
import ChartV2 from './ChartV2';
import DropdownIcon from '../Common/DropdownIcon';
import SelectDialog from './SelectDialog';
import { useChartSetupData } from './useChartSetupData';
import CalendarButton from '../Common/CalendarButton';

const MegaChart: FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const season = useSeason();
  const chartSetupData = useChartSetupData();

  const [timePeriod, setTimePeriod] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const [dialogOpen, showDialog, hideDialog] = useToggle();
  const [selectedCharts, setSelectedCharts] = useState([0]);
  const [queryData, setQueryData] = useState<any[]>([]);
  const [moreData, setMoreData] = useState<Map<any, any>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  useMemo(() => {
    async function getSeasonData(getAllData?: boolean) {
      const promises: any[] = [];
      const output: any[] = [];
      const extraOutput = new Map();
      const timestamps = new Map();

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
                    }
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
                      };
                      extraOutput.set(formattedTime, seasonData.season);
                    }
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
      setMoreData(extraOutput);
    }

    setLoading(true);
    getSeasonData(true);
    setLoading(false);
  }, [chartSetupData, selectedCharts, season]);

  const totalHeight = 600;

  return (
    <>
      <Box display="flex" flexDirection="row" gap={2}>
        <Card sx={{ position: 'relative', width: '100%', height: 600 }}>
          {!isMobile ? (
            <Card
              sx={{
                position: 'absolute',
                left: dialogOpen ? '0%' : '-100%',
                width: 700,
                zIndex: 4,
                height: 600,
                transition: 'left 0.3s',
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
            p={1.5}
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
                      alignItems: 'center',
                      cursor: 'pointer',
                      border: '0.5px solid',
                      borderColor: 'divider',
                      fontWeight: 'normal',
                      color: 'text.primary',
                      boxSizing: 'border-box',
                      paddingY: 0.25,
                      paddingX: 0.75,
                    }}
                    endIcon={
                      <DropdownIcon open={false} sx={{ fontSize: 20 }} />
                    }
                    onClick={() => showDialog()}
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
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor: 'divider',
                    fontWeight: 'normal',
                    color: 'text.primary',
                    boxSizing: 'border-box',
                    paddingY: 0.25,
                    paddingX: 0.75,
                  }}
                  endIcon={<DropdownIcon open={false} sx={{ fontSize: 20 }} />}
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    color: 'primary.main',
                    backgroundColor: 'secondary.main',
                    boxSizing: 'border-box',
                    paddingY: 0.25,
                    paddingX: 0.75,
                    '&:hover': {
                      color: 'primary.contrastText',
                    },
                  }}
                  endIcon={<AddRoundedIcon fontSize="small" color="inherit" />}
                  onClick={() => showDialog()}
                >
                  Add another
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
          ) : (
            <ChartV2
              formattedData={queryData}
              extraData={moreData}
              selected={selectedCharts}
              drawPegLine
              timePeriod={timePeriod}
              containerHeight={545}
            />
          )}
        </Card>
      </Box>
    </>
  );
};

export default MegaChart;
