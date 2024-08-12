import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Grow,
  IconButton,
  Popper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FC } from '~/types';
import { CreatePriceLineOptions, IChartApi, ISeriesApi, MouseEventParams, Range, TickMarkType, Time, createChart } from 'lightweight-charts';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { setHours } from 'date-fns';
import { VertLine } from '~/util/lightweight-charts-plugins/vertical-line/vertical-line';
import { useChartSetupData } from './useChartSetupData';
import { chartColors } from './chartColors';

type ChartV2DataProps = {
  /** 
   * Series of timestampped values to be charted.
   * Must be in ascending order.
   */
  formattedData: { time: Time, value: number, customValues: { season: number } }[][];
  /**
   * Draw $1 peg line?
   */
  drawPegLine?: boolean;
  /**
   * Selects which version to show. Mini charts are used for 
   * compact views and forgo the following:
   * - Price Scales
   * - Time Scale
   * - Labels
   * - Season Display
   */
  size?: 'mini' | 'full';
  /**
   * Time period to automatically set the chart to.
   */
  timePeriod?: Range<Time>;
  /**
   * Draws a line at the timestamp of the exploit.
   */
  drawExploitLine?: boolean;
  /**
   * Ids of the currently selected charts.
   */
  selected: number[];
};

const ChartV2: FC<ChartV2DataProps> = ({
  formattedData,
  drawPegLine,
  size = 'full',
  timePeriod,
  drawExploitLine = true,
  selected
}) => {
  const chartContainerRef = useRef<any>();
  const chart = useRef<IChartApi>();
  const areaSeries = useRef<ISeriesApi<"Line">[]>([]);
  const tooltip = useRef<any>();

  const [lastDataPoint, setLastDataPoint] = useState<any>();
  const [firstDataPoint, setFirstDataPoint] = useState<any>();
  const [dataPoint, setDataPoint] = useState<any>();

  function getTimezoneCorrectedTime(utcTime: Date, tickMarkType: TickMarkType) {
    let timestamp
    if (utcTime instanceof Date) {
      timestamp = utcTime.getTime() / 1000
    } else {
      timestamp = utcTime
    };
    const correctedTime = new Date((timestamp * 1000));
    let options = {};
    switch(tickMarkType) {
      case TickMarkType.Year:
          options = {
             year: 'numeric'
          }
          break
      case TickMarkType.Month:
          options = {
              month: 'short'
          }
          break
      case TickMarkType.DayOfMonth:
          options = {
              day: '2-digit'
          }
          break
      case TickMarkType.Time:
          options = {
              hour: '2-digit',
              minute: '2-digit'
          }
          break
      default:
          options = {
              hour: '2-digit',
              minute: '2-digit',
              seconds: '2-digit'
          };
    };
    return correctedTime.toLocaleString('en-GB', options);
  };

  // Menu
  const [leftAnchorEl, setLeftAnchorEl] = useState<null | HTMLElement>(null);
  const [rightAnchorEl, setRightAnchorEl] = useState<null | HTMLElement>(null);
  const leftMenuVisible = Boolean(leftAnchorEl);
  const rightMenuVisible = Boolean(rightAnchorEl);
  const handleToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, side: string) => {
      if (side === 'left') {
        setLeftAnchorEl(leftAnchorEl ? null : event.currentTarget);
      } else {
        setRightAnchorEl(rightAnchorEl ? null : event.currentTarget);
      }
    },
    [leftAnchorEl, rightAnchorEl]
  );
  const [leftPriceScaleMode, setLeftPriceScaleMode] = useState(0);
  const [rightPriceScaleMode, setRightPriceScaleMode] = useState(0);
  const priceScaleModes = [
    'Normal',
    'Logarithmic',
    'Percentage',
    'Indexed to 100',
  ];

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const chartSetupData = useChartSetupData();

  const chartAxisTypes = selected.map(
    (chartId) => chartSetupData[chartId].valueAxisType
  );
  const secondPriceScale = new Set(chartAxisTypes).size > 1;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: {
        fontFamily: theme.typography.fontFamily,
        background: { color: 'rgba(0, 0, 0, 0)' },
      },
      grid: {
        vertLines: { color: theme.palette.divider, visible: false },
        horzLines: { color: theme.palette.divider, visible: false },
      },
      crosshair: {
        // visible: false,
        vertLine: {
          //  labelVisible: false,
          labelBackgroundColor: theme.palette.text.primary,
        },
        horzLine: {
          // labelVisible: false,
          labelBackgroundColor: theme.palette.primary.main,
        },
      },
      localization: {
        timeFormatter: (timestamp: number) => new Date(timestamp * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        visible: !(size === 'mini'),
        minBarSpacing: 0.001,
        tickMarkFormatter: (time: Date, tickMarkType: TickMarkType) => getTimezoneCorrectedTime(time, tickMarkType)
      },
      rightPriceScale: {
        borderVisible: false,
        mode: 0,
        visible: !(size === 'mini'),
      },
      leftPriceScale: !secondPriceScale
        ? undefined
        : {
            borderVisible: false,
            mode: 0,
            visible: !(size === 'mini'),
          },
      overlayPriceScale: {
        scaleMargins: {
          top: 0.8, // highest point of the series will be 80% away from the top
          bottom: 0.2,
        },
      }
    };

    const handleResize = () => {
      chart.current?.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight
      });
    };

    chart.current = createChart(chartContainerRef.current, chartOptions);
    const numberOfCharts = selected.length;
    const priceScaleIds: string[] = [];
    if (numberOfCharts > 0) {
      for (let i = 0; i < numberOfCharts; i += 1) {
        const chartSetup = chartSetupData[selected[i]];
        let scaleId = '';
        const findScale = priceScaleIds.findIndex(
          (value) => value === chartSetup.valueAxisType
        );
        if (findScale > -1) {
          scaleId = findScale > 1 ? chartSetup.valueAxisType : findScale === 0 ? 'right' : 'left';
        } else {
          if (priceScaleIds.length === 0) {
            priceScaleIds[0] = chartSetup.valueAxisType;
            scaleId = 'right';
          } else if (priceScaleIds.length === 1) {
            priceScaleIds[1] = chartSetup.valueAxisType;
            scaleId = 'left';
          } else {
            scaleId = chartSetup.valueAxisType;
          };
        };

        areaSeries.current[i] = chart.current.addLineSeries({
          color: chartColors[i].lineColor,
          // topColor: chartColors[i].topColor,
          // bottomColor: chartColors[i].bottomColor,
          lineWidth: 2,
          priceScaleId: scaleId,
          priceFormat: {
            type: 'custom',
            formatter: chartSetupData[selected[i]].shortTickFormatter,
          },
        });

        if (drawPegLine) {
          const pegLine: CreatePriceLineOptions = {
            price: 1,
            color: theme.palette.primary.dark,
            lineWidth: 1,
            lineStyle: 3, // LineStyle.Dashed
            axisLabelVisible: false,
            // title: 'line label here',
          };
          areaSeries.current[i].createPriceLine(pegLine);
        }

        if (drawExploitLine) {
          const exploitTimestamp = 1650196810 as Time;
          const vertLine = new VertLine(chart.current, areaSeries.current[i], exploitTimestamp, {
            width: 0.5
          });
          areaSeries.current[i].attachPrimitive(vertLine);
        };

      }
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.current?.remove();
    };
  }, [
    theme,
    drawPegLine,
    drawExploitLine,
    size,
    formattedData,
    chartSetupData,
    selected,
    secondPriceScale
  ]);

  useEffect(() => {
    chart.current?.applyOptions({
      leftPriceScale: {
        mode: leftPriceScaleMode
      },
      rightPriceScale: {
        mode: rightPriceScaleMode
      },
    });
  }, [rightPriceScaleMode, leftPriceScaleMode]);

  useMemo(() => {
    if (lastDataPoint) {
      const from = timePeriod?.from;
      const to = timePeriod?.to;
      if (!from) {
        chart.current?.timeScale().fitContent();
      } else if (from && !to) {
        const newFrom = setHours(new Date(from.valueOf() as number * 1000), 0);
        const newTo = setHours(new Date(from.valueOf() as number * 1000), 23);
        chart.current?.timeScale().setVisibleRange({
          from: (newFrom.valueOf() / 1000) as Time,
          to: (newTo.valueOf() / 1000) as Time,
        });
      } else {
        chart.current?.timeScale().setVisibleRange({
          from: from,
          to: to!,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod]);

  useEffect(() => {
    if (!chart.current || !formattedData) return;

    const numberOfCharts = selected?.length || 0;
    for (let i = 0; i < numberOfCharts; i += 1) {
      if (!formattedData[selected[i]]) return;
      areaSeries.current[i].setData(formattedData[selected[i]]);
    };

    const storedSetting = localStorage.getItem('advancedChartTimePeriod');
    const storedTimePeriod = storedSetting ? JSON.parse(storedSetting) : undefined;

    if (size === 'full' && storedTimePeriod) {
      chart.current?.timeScale().setVisibleRange(storedTimePeriod);
    };

    function getDataPoint(mode: string) {
      let _time = 0;
      const _value: number[] = [];
      let _season = 0;

      selected.forEach((selection) => {
        const selectedData = formattedData[selection];
        const dataIndex = mode === 'last' ? selectedData.length - 1 : 0; 
        _time = Math.max(_time, selectedData[dataIndex].time.valueOf() as number);
        _season = Math.max(_season, selectedData[dataIndex].customValues.season);
        _value.push(selectedData[dataIndex].value);
      });

      return {
        time: new Date(_time * 1000)?.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
        value: _value,
        season: _season,
        timestamp:_time
      };
    };

    setLastDataPoint(getDataPoint('last'));
    setFirstDataPoint(getDataPoint('first'));

    function crosshairMoveHandler(param: MouseEventParams) {
      const hoveredTimestamp = param.time ? new Date(param.time?.valueOf() as number * 1000) : null;
      const hoveredValues: number[] = [];
      let hoveredSeason = 0;
      areaSeries.current.forEach((series) => {
        const seriesValueBefore = series.dataByIndex(param.logical?.valueOf() as number, -1);
        const seriesValueAfter = series.dataByIndex(param.logical?.valueOf() as number, 1);
        // @ts-ignore
        hoveredValues.push(seriesValueBefore && seriesValueAfter ? seriesValueBefore?.value : 0);
        hoveredSeason = Math.max(hoveredSeason, (seriesValueBefore?.customValues!.season as number || 0));
      });
      if (!param.time) {
        setDataPoint(undefined);
      } else {
        setDataPoint({
          time: param.time ? hoveredTimestamp?.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : null,
          value: param.time ? hoveredValues : null,
          season: param.time ? hoveredSeason : null,
          timestamp: param.time?.valueOf() as number
        });
      };
    };

    function timeRangeChangeHandler(param: Range<Time> | null) {
      if (!param) return;
      const lastTimestamp = new Date(param.to.valueOf() as number * 1000);
      const lastValues = selected.map((selection) => (formattedData[selection].find((value) => value.time === param.to))?.value);
      const lastSeasons = selected.map((selection) => (formattedData[selection].find((value) => value.time === param.to))?.customValues.season || 0);
      const lastSeason = Math.max(...lastSeasons);
      setLastDataPoint({
        time: lastTimestamp?.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', }),
        value: lastValues,
        season: lastSeason,
        timestamp: param.to.valueOf()
      });
    };

    chart.current.subscribeCrosshairMove(crosshairMoveHandler);
    chart.current.timeScale().subscribeVisibleTimeRangeChange(timeRangeChangeHandler);

    return () => {
      chart.current?.unsubscribeCrosshairMove(crosshairMoveHandler);
      chart.current?.timeScale().unsubscribeVisibleTimeRangeChange(timeRangeChangeHandler);
    };
  }, [formattedData, selected, size]);

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Box sx={{ height: isMobile ? selected.length > 2 ? '104px' : '88px' : undefined }}>
        <Box
          ref={tooltip}
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: isMobile && selected.length > 2 ? 'column' : 'row',
            padding: 0,
            marginTop: isMobile && selected.length > 2 ? 0.25 : 2,
            marginLeft: 2,
            zIndex: 3,
            gap: isMobile && selected.length > 2 ? 0.2 : 2,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          }}
        >
          {selected.map((chartId, index) => {
            const tooltipTitle = chartSetupData[chartId].tooltipTitle;
            const tooltipHoverText = chartSetupData[chartId].tooltipHoverText;
            const beforeFirstSeason = dataPoint && firstDataPoint ? dataPoint.timestamp < firstDataPoint[index]?.timestamp : false;
            const value = beforeFirstSeason ? 0 : dataPoint ? dataPoint?.value[index] : lastDataPoint ? lastDataPoint?.value[index] : undefined;
            if (!isMobile || selected.length < 3) {
              return (
                <Box key={`selectedChartV2${index}`} sx={{ display: 'flex', flexDirection: 'column', height: size === 'mini' ? '64px' : '88px' }}>
                  <Box
                    sx={{
                      borderLeft: selected.length > 1 ? 2.5 : 0,
                      paddingLeft: selected.length > 1 ? 1 : 0,
                      borderColor: chartColors[index].lineColor,
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                      <Box sx={{ display: 'flex' }}>
                        <Typography variant="body1">{tooltipTitle}</Typography>
                        {tooltipHoverText && (
                          <Tooltip
                            title={tooltipHoverText}
                            placement={isMobile ? 'top' : 'right'}
                          >
                            <HelpOutlineIcon
                              sx={{
                                color: 'text.secondary',
                                display: 'inline',
                                mb: 0.5,
                                fontSize: '11px',
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                      <Typography variant="h2">
                        {chartSetupData[chartId].tickFormatter(value || 0)}
                      </Typography>
                  </Box>
                  {index === 0 && (
                    <>
                      {size !== 'mini' && 
                      <Typography variant="bodySmall" color="text.primary">
                        Season{' '}
                        {dataPoint && dataPoint.season
                          ? dataPoint.season
                          : lastDataPoint && lastDataPoint.season
                            ? lastDataPoint.season
                            : 0}
                      </Typography>
                      }
                      <Typography variant="bodySmall" color="text.primary">
                        {dataPoint && dataPoint.time
                          ? dataPoint.time
                          : lastDataPoint && lastDataPoint.time
                            ? lastDataPoint.time
                            : 0}
                      </Typography>
                    </>
                  )}
                </Box>
              );
            }

            return (
              <Box key={`selectedChartV2Mobile${index}`} sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexGrow: 1,
                      borderLeft: selected.length > 1 ? 2.5 : 0,
                      paddingLeft: selected.length > 1 ? 0.25 : 0,
                      marginRight: 2,
                      borderColor: chartColors[index].lineColor,
                    }}
                  >
                      <Box sx={{ display: 'flex', flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', flexGrow: 1 }}>
                          <Typography fontSize={15}>{tooltipTitle}</Typography>
                          {tooltipHoverText && (
                            <Tooltip
                              title={tooltipHoverText}
                              placement={isMobile ? 'top' : 'right'}
                            >
                              <HelpOutlineIcon
                                sx={{
                                  color: 'text.secondary',
                                  display: 'inline',
                                  mb: 0.5,
                                  fontSize: '11px',
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                        <Typography fontSize={16} fontWeight={600} justifyItems='flex-end'>
                          {chartSetupData[chartId].tickFormatter(value || 0)}
                        </Typography>
                      </Box>
                  </Box>
              </Box>
              );
            }
          )}
        </Box>
        {isMobile && selected.length > 2 && 
          <Box sx={{ display: 'flex', flexGrow: 1, paddingX: 2 }}>
              <Typography variant="bodySmall" color="text.primary" flexGrow={1}>
                        Season{' '}
                        {dataPoint && dataPoint.season
                          ? dataPoint.season
                          : lastDataPoint && lastDataPoint.season
                            ? lastDataPoint.season
                            : 0}
                      </Typography>
                      <Typography variant="bodySmall" color="text.primary">
                        {dataPoint && dataPoint.time
                          ? dataPoint.time
                          : lastDataPoint && lastDataPoint.time
                            ? lastDataPoint.time
                            : 0}
                      </Typography>
          </Box>
        }
      </Box>
      <Box
        ref={chartContainerRef}
        id="container"
        sx={{
          height: `calc(100% - ${size === 'mini' ? '85px' : '160px'})`,
        }}
      />
      {size === 'full' && (
          <>
            <IconButton
              disableRipple
              onClick={(e) => handleToggleMenu(e, 'right')}
              sx={{
                p: 0,
                position: 'absolute',
                bottom: isMobile ? '64px' : '80px',
                right: '24px',
              }}
            >
              <SettingsIcon
                sx={{
                  fontSize: 20,
                  color: 'text.primary',
                  transform: `rotate(${rightAnchorEl ? 30 : 0}deg)`,
                  transition: 'transform 150ms ease-in-out',
                }}
              />
            </IconButton>
            <Popper
              anchorEl={rightAnchorEl}
              open={rightMenuVisible}
              sx={{ zIndex: 79 }}
              placement="bottom-end"
              // Align the menu to the bottom
              // right side of the anchor button.
              transition
            >
              {({ TransitionProps }) => (
                <Grow
                  {...TransitionProps}
                  timeout={200}
                  style={{ transformOrigin: 'top right' }}
                >
                  <Box
                    sx={{
                      borderWidth: 2,
                      borderColor: 'divider',
                      borderStyle: 'solid',
                      backgroundColor: 'white',
                      borderRadius: 1,
                      '& .MuiInputBase-root:after, before': {
                        borderColor: 'primary.main',
                      },
                      overflow: 'clip',
                    }}
                  >
                    <Stack gap={0}>
                      {priceScaleModes.map((mode, index) => (
                        <Button
                          variant="text"
                          sx={{
                            fontWeight: 400,
                            color: 'text.primary',
                            paddingY: 0.5,
                            paddingX: 1,
                            height: 'auto',
                            justifyContent: 'space-between',
                            borderRadius: 0,
                            width: '150px',
                            backgroundColor:
                              rightPriceScaleMode === index
                                ? 'primary.light'
                                : undefined,
                            '&:hover': {
                              backgroundColor: '#F5F5F5',
                              cursor: 'pointer',
                            },
                          }}
                          onClick={() => setRightPriceScaleMode(index)}
                        >
                          {mode}
                          {rightPriceScaleMode === index && (
                            <CheckRoundedIcon fontSize="inherit" />
                          )}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                </Grow>
              )}
            </Popper>
          </>      )}
      {size === 'full' && secondPriceScale && (
          <>
            <IconButton
              disableRipple
              onClick={(e) => handleToggleMenu(e, 'left')}
              sx={{
                p: 0,
                position: 'absolute',
                bottom: isMobile ? '64px' : '80px',
                left: '24px',
              }}
            >
              <SettingsIcon
                sx={{
                  fontSize: 20,
                  color: 'text.primary',
                  transform: `rotate(${leftAnchorEl ? 30 : 0}deg)`,
                  transition: 'transform 150ms ease-in-out',
                }}
              />
            </IconButton>
            <Popper
              anchorEl={leftAnchorEl}
              open={leftMenuVisible}
              sx={{ zIndex: 79 }}
              placement="bottom-start"
              // Align the menu to the bottom
              // right side of the anchor button.
              transition
            >
              {({ TransitionProps }) => (
                <Grow
                  {...TransitionProps}
                  timeout={200}
                  style={{ transformOrigin: 'top right' }}
                >
                  <Box
                    sx={{
                      borderWidth: 2,
                      borderColor: 'divider',
                      borderStyle: 'solid',
                      backgroundColor: 'white',
                      borderRadius: 1,
                      '& .MuiInputBase-root:after, before': {
                        borderColor: 'primary.main',
                      },
                      overflow: 'clip',
                    }}
                  >
                    <Stack gap={0}>
                      {priceScaleModes.map((mode, index) => (
                        <Button
                          variant="text"
                          sx={{
                            fontWeight: 400,
                            color: 'text.primary',
                            paddingY: 0.5,
                            paddingX: 1,
                            height: 'auto',
                            justifyContent: 'space-between',
                            borderRadius: 0,
                            width: '150px',
                            backgroundColor:
                              leftPriceScaleMode === index
                                ? 'primary.light'
                                : undefined,
                            '&:hover': {
                              backgroundColor: '#F5F5F5',
                              cursor: 'pointer',
                            },
                          }}
                          onClick={() => setLeftPriceScaleMode(index)}
                        >
                          {mode}
                          {leftPriceScaleMode === index && (
                            <CheckRoundedIcon fontSize="inherit" />
                          )}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                </Grow>
              )}
            </Popper>
          </>
      )}
    </Box>
  );
};

export default ChartV2;