import React, { useMemo, useState } from 'react';
import { FC } from '~/types';
import { Box, Button, Card, CircularProgress, Drawer } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseIcon from '@mui/icons-material/Close';
import useToggle from '~/hooks/display/useToggle';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Range, Time } from 'lightweight-charts';
import { useQueries } from '@tanstack/react-query';
import { fetchAllSeasonData } from '~/util/Graph';
import { exists, mayFunctionToValue } from '~/util';
import { RESEED_SEASON } from '~/constants';
import useIsMounted from '~/hooks/display/useIsMounted';
import ChartV2 from './ChartV2';
import DropdownIcon from '../Common/DropdownIcon';
import SelectDialog from './SelectDialog';
import { useChartSetupData } from './useChartSetupData';
import CalendarButton from './CalendarButton';

export type ChartQueryData = {
  time: Time;
  value: number;
  customValues: {
    season: number;
  };
};

type QueryData = ChartQueryData;

const AdvancedChart: FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const season = useSeason();
  const chartSetupData = useChartSetupData();

  // wait to mount before fetching data
  const mounted = useIsMounted();

  const storedSetting1 = localStorage.getItem('advancedChartTimePeriod');
  const storedTimePeriod = storedSetting1 ? JSON.parse(storedSetting1) : undefined;
  const storedSetting2 = localStorage.getItem('advancedChartSelectedCharts');
  const storedSelectedCharts = storedSetting2 ? JSON.parse(storedSetting2) : undefined;

  const [timePeriod, setTimePeriod] = useState<Range<Time> | undefined>(storedTimePeriod);
  const [selectedCharts, setSelectedCharts] = useState<number[]>(storedSelectedCharts || [0]);

  const [dialogOpen, showDialog, hideDialog] = useToggle();
  const queries = useQueries({
    queries: selectedCharts.map((chartId) => {
      const params = chartSetupData[chartId];
      const queryKey = ['analytics', params.id, season.toNumber()];
      return {
        queryKey,
        queryFn: async () => {
          const dataFormatter = params.dataFormatter;
          const valueFormatter = params.valueFormatter;
          const priceKey = params.priceScaleKey;
          const timestamps = new Set<number>();

          const allSeasonData = await fetchAllSeasonData(params, season.toNumber());
          const output = allSeasonData.map((seasonData) => {
            try {
              const time = Number(seasonData[params.timeScaleKey]);
              const data = dataFormatter ? dataFormatter?.(seasonData): seasonData;
              const value = mayFunctionToValue<number>(
                valueFormatter(data[priceKey]), 
                seasonData.season <= RESEED_SEASON - 1 ? 'l1' : 'l2'
              );

              const invalidTime = !exists(time) || timestamps.has(time) || time <= 0;
              if (invalidTime || !exists(value)) return undefined;

              timestamps.add(time);

              return {
                time: time as Time,
                value,
                customValues: {
                  season: data.season,
                },
              } as QueryData;
            } catch (e) {
              console.debug(`[advancedChart] failed to process some data for ${queryKey}`, e);
              return undefined;
            }
          }).filter(Boolean) as QueryData[];

          // Sort by time
          const data = output.sort((a, b) => Number(a.time) - Number(b.time));
          console.debug(`[advancedChart] ${queryKey}`, data);
          return data as QueryData[];
        },
        retry: false,
        enabled: mounted && season.gt(0),
        staleTime: Infinity,
      };
    }),
  });

  const error = useMemo(() => queries.find((a) => !!a.error)?.error, [queries]);

  const loading = queries.every((q) => q.isLoading) && queries.length > 0;

  const queryData = useMemo(
    () => queries.map((q) => q.data).filter(Boolean) as QueryData[][],
    [queries]
  );

  function handleDeselectChart(selectionIndex: number) {
    const newSelection = [...selectedCharts];
    newSelection.splice(selectionIndex, 1);
    setSelectedCharts(newSelection);
    localStorage.setItem(
      'advancedChartSelectedCharts',
      JSON.stringify(newSelection)
    );
  }

  return (
    <>
      <Box display="flex" flexDirection="row" gap={2}>
        <Card
          sx={{
            position: 'relative',
            width: '100%',
            height: '70vh',
            overflow: 'clip',
          }}
        >
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
                borderLeftColor: 'transparent',
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
                      <CloseIcon
                        sx={{ color: 'inherit', marginTop: '0.5px' }}
                      />
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
                  endIcon={
                    <DropdownIcon
                      open={false}
                      sx={{ fontSize: 20, marginTop: '0.5px' }}
                    />
                  }
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
                  endIcon={
                    <AddRoundedIcon
                      fontSize="small"
                      color="inherit"
                      sx={{ marginTop: '0.5px' }}
                    />
                  }
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
          ) : selectedCharts.length > 0 ? (
            <ChartV2
              formattedData={queryData}
              selected={selectedCharts}
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
              Click the Add Data button to start charting
            </Box>
          )}
        </Card>
      </Box>
    </>
  );
};

export default AdvancedChart;
