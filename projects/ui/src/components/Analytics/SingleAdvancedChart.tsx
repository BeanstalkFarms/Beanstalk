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
  CircularProgress,
  ClickAwayListener,
  Grow,
  IconButton,
  Popper,
  Stack,
  useTheme,
} from '@mui/material';
import {
  createChart,
  CreatePriceLineOptions,
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  Range,
  TickMarkType,
  Time,
} from 'lightweight-charts';
import { VertLine } from '~/util/lightweight-charts-plugins/vertical-line/vertical-line';
import { setHours } from 'date-fns';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import useChartTimePeriodState from '~/hooks/display/useChartTimePeriodState';
import CalendarButton from './CalendarButton';
import { ChartV2DataProps } from './ChartV2';
import { chartColors } from './chartColors';
import { ChartQueryData } from './AdvancedChart';
import ChartInfoOverlay from '../Common/Charts/ChartInfoOverlay';

const ChartErrorState = () => (
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
);

const ChartLoadingState = () => (
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
);

const ChartEmptyState = () => (
  <Box
    sx={{
      display: 'flex',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    Chart data will load here
  </Box>
);

const getTimezoneCorrectedTime = (
  utcTime: Date,
  tickMarkType: TickMarkType
) => {
  const timestamp =
    utcTime instanceof Date ? utcTime.getTime() / 1000 : utcTime;
  const correctedTime = new Date(timestamp * 1000);
  let options = {};
  switch (tickMarkType) {
    case TickMarkType.Year:
      options = {
        year: 'numeric',
      };
      break;
    case TickMarkType.Month:
      options = {
        month: 'short',
      };
      break;
    case TickMarkType.DayOfMonth:
      options = {
        day: '2-digit',
      };
      break;
    case TickMarkType.Time:
      options = {
        hour: '2-digit',
        minute: '2-digit',
      };
      break;
    default:
      options = {
        hour: '2-digit',
        minute: '2-digit',
        seconds: '2-digit',
      };
  }
  return correctedTime.toLocaleString('en-GB', options);
};

const priceScaleModes = [
  'Normal',
  'Logarithmic',
  'Percentage',
  'Indexed to 100',
];

type OmmitedV2DataProps = Omit<
  ChartV2DataProps,
  'timePeriod' | 'selected' | 'formattedData'
>;

type ChartProps = OmmitedV2DataProps & {
  seriesData: ChartQueryData[];
  tickFormatter: (v: number) => string | undefined;
  timeState: ReturnType<typeof useChartTimePeriodState>;
  valueAxisType: string;
  tooltipHoverText: string;
  tooltipTitle: string;
  storageKeyPrefix?: string;
  isLoading?: boolean;
  isError?: boolean;
};

type DataPoint = {
  time: string | null;
  value: number | null;
  season: number | null;
  timestamp: string | number | Object;
};

const Chart = ({
  drawPegLine,
  size = 'full',
  drawExploitLine = true,
  seriesData,
  valueAxisType,
  timeState,
  isLoading,
  isError,
  tooltipHoverText,
  storageKeyPrefix,
  tooltipTitle,
  tickFormatter,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chart = useRef<IChartApi>();
  const areaSeries = useRef<ISeriesApi<'Line'>>();

  const [lastDataPoint, setLastDataPoint] = useState<DataPoint>();
  const [firstDataPoint, setFirstDataPoint] = useState<DataPoint>();
  const [dataPoint, setDataPoint] = useState<DataPoint>();

  const [timePeriod, setTimePeriod] = timeState;

  const theme = useTheme();

  // Menu
  const [rightAnchorEl, setRightAnchorEl] = useState<null | HTMLElement>(null);
  const rightMenuVisible = Boolean(rightAnchorEl);

  const [rightPriceScaleMode, setRightPriceScaleMode] = useState(0);

  const handleToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setRightAnchorEl(rightAnchorEl ? null : event.currentTarget);
    },
    [rightAnchorEl]
  );

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
        vertLine: {
          labelBackgroundColor: theme.palette.text.primary,
        },
        horzLine: {
          labelBackgroundColor: theme.palette.primary.main,
        },
      },
      localization: {
        timeFormatter: (timestamp: number) =>
          new Date(timestamp * 1000).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        visible: !(size === 'mini'),
        minBarSpacing: 0.001,
        tickMarkFormatter: (time: Date, tickMarkType: TickMarkType) =>
          getTimezoneCorrectedTime(time, tickMarkType),
      },
      rightPriceScale: {
        borderVisible: false,
        alignLabels: true,
        mode: 0,
        visible: !(size === 'mini'),
      },
      overlayPriceScale: {
        scaleMargins: {
          top: 0.8, // highest point of the series will be 80% away from the top
          bottom: 0.2,
        },
      },
    };

    const handleResize = () => {
      chart.current?.applyOptions({
        width: chartContainerRef.current?.clientWidth,
        height: chartContainerRef.current?.clientHeight,
      });
    };

    chart.current = createChart(chartContainerRef.current, chartOptions);
    const priceScaleIds: string[] = [];
    let scaleId = '';
    const findScale = priceScaleIds.findIndex(
      (value) => value === valueAxisType
    );
    if (findScale > -1) {
      scaleId =
        findScale > 1 ? valueAxisType : findScale === 0 ? 'right' : 'left';
    } else if (priceScaleIds.length === 0) {
      priceScaleIds[0] = valueAxisType;
      scaleId = 'right';
    } else if (priceScaleIds.length === 1) {
      priceScaleIds[1] = valueAxisType;
      scaleId = 'left';
    } else {
      scaleId = valueAxisType;
    }

    areaSeries.current = chart.current.addLineSeries({
      color: chartColors[0].lineColor,
      lineWidth: 2,
      priceScaleId: scaleId,
      priceFormat: {
        type: 'custom',
        formatter: tickFormatter,
      },
    });

    if (drawPegLine) {
      const pegLine: CreatePriceLineOptions = {
        price: 1,
        color: theme.palette.primary.dark,
        lineWidth: 1,
        lineStyle: 3, // LineStyle.Dashed
        axisLabelVisible: false,
      };
      areaSeries.current.createPriceLine(pegLine);
    }

    if (drawExploitLine) {
      const exploitTimestamp = 1650196810 as Time;
      const vertLine = new VertLine(
        chart.current,
        areaSeries.current,
        exploitTimestamp,
        { width: 0.5 }
      );
      areaSeries.current?.attachPrimitive(vertLine);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.current?.remove();
    };
  }, [
    seriesData,
    theme,
    drawPegLine,
    drawExploitLine,
    size,
    tickFormatter,
    valueAxisType,
  ]);

  // console.log("chartref: ", chart.current);
  // console.log('seriesData: ', seriesData);

  useEffect(() => {
    chart.current?.applyOptions({
      rightPriceScale: {
        mode: rightPriceScaleMode,
      },
    });
  }, [rightPriceScaleMode]);

  useMemo(() => {
    if (!chart.current) return;
    if (lastDataPoint) {
      const from = timePeriod?.from;
      const to = timePeriod?.to;
      if (!from) {
        chart.current?.timeScale().fitContent();
      } else if (from && !to) {
        const newFrom = setHours(
          new Date((from.valueOf() as number) * 1000),
          0
        );
        const newTo = setHours(new Date((from.valueOf() as number) * 1000), 23);
        chart?.current?.timeScale()?.setVisibleRange({
          from: (newFrom.valueOf() / 1000) as Time,
          to: (newTo.valueOf() / 1000) as Time,
        });
      } else if (from && to) {
        chart?.current?.timeScale().setVisibleRange({
          from: from,
          to: to,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod]);

  useEffect(() => {
    if (!chart.current || !seriesData?.length) return;
    areaSeries.current?.setData(seriesData);

    const storedSetting = localStorage.getItem(`${storageKeyPrefix}TimePeriod`);
    const storedTimePeriod = storedSetting
      ? JSON.parse(storedSetting)
      : undefined;

    chart.current?.timeScale()?.setVisibleRange(storedTimePeriod);

    const getDataPoint = (mode: string) => {
      let _time = 0;
      let _season = 0;

      const dataIndex = mode === 'last' ? seriesData.length - 1 : 0;
      _time = Math.max(_time, seriesData[dataIndex].time.valueOf() as number);
      _season = Math.max(_season, seriesData[dataIndex].customValues.season);
      const value = seriesData[dataIndex].value;

      return {
        time: new Date(_time * 1000)?.toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        value: value,
        season: _season,
        timestamp: _time,
      };
    };

    setLastDataPoint(getDataPoint('last'));
    setFirstDataPoint(getDataPoint('first'));

    function crosshairMoveHandler(param: MouseEventParams) {
      const hoveredTimestamp = param.time
        ? new Date((param.time?.valueOf() as number) * 1000)
        : null;
      let hoveredSeason = 0;

      const seriesValueBefore = areaSeries.current?.dataByIndex(
        param.logical?.valueOf() as number,
        -1
      );
      const seriesValueAfter = areaSeries.current?.dataByIndex(
        param.logical?.valueOf() as number,
        1
      );
      const hoveredValue =
        seriesValueBefore && seriesValueAfter && 'value' in seriesValueBefore
          ? seriesValueBefore?.value
          : 0;
      hoveredSeason = Math.max(
        hoveredSeason,
        (seriesValueBefore?.customValues!.season as number) || 0
      );

      if (!param.time) {
        setDataPoint(undefined);
      } else {
        setDataPoint({
          time:
            (param.time &&
              hoveredTimestamp?.toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              })) ||
            null,
          value: param.time ? hoveredValue : null,
          season: param.time ? hoveredSeason : null,
          timestamp: param.time?.valueOf() as number,
        });
      }
    }

    function timeRangeChangeHandler(param: Range<Time> | null) {
      if (!param) return;
      // console.log('param: ', param);
      const lastTimestamp = new Date((param.to.valueOf() as number) * 1000);
      const lastValue =
        seriesData.find((value) => value.time === param.to)?.value || 0;
      const lastSeason =
        seriesData.find((value) => value.time === param.to)?.customValues
          .season || 0;
      setLastDataPoint({
        time: lastTimestamp?.toLocaleString('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        value: lastValue,
        season: lastSeason,
        timestamp: param.to.valueOf(),
      });
    }

    chart.current.subscribeCrosshairMove(crosshairMoveHandler);
    chart.current
      .timeScale()
      .subscribeVisibleTimeRangeChange(timeRangeChangeHandler);

    return () => {
      chart.current?.unsubscribeCrosshairMove(crosshairMoveHandler);
      chart.current
        ?.timeScale()
        .unsubscribeVisibleTimeRangeChange(timeRangeChangeHandler);
    };
  }, [seriesData, size, storageKeyPrefix]);

  const beforeFirstSeason =
    dataPoint && firstDataPoint
      ? dataPoint.timestamp < firstDataPoint?.timestamp
      : false;

  const currDataPoint = dataPoint || lastDataPoint;

  const currValue = !beforeFirstSeason && currDataPoint?.value;
  const currSeason = !beforeFirstSeason && currDataPoint?.season;
  const currTimestamp = !beforeFirstSeason && currDataPoint?.time;

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Box>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={2}
        >
          <ChartInfoOverlay
            isLoading={isLoading || false}
            gap={0}
            title={tooltipTitle}
            titleTooltip={tooltipHoverText}
            amount={
              <>{currValue ? tickFormatter(currValue)?.toString() : '0'}</>
            }
            subtitle={`Season ${currSeason || '--'}`}
            secondSubtitle={`${currTimestamp || '--'}`}
          />
          <CalendarButton
            storageKeyPrefix={storageKeyPrefix}
            setTimePeriod={setTimePeriod}
          />
        </Stack>
      </Box>
      <Box
        ref={chartContainerRef}
        id="container"
        sx={{ height: 'calc(100% - 85px)' }}
      >
        {isLoading && <ChartLoadingState />}
        {isError && <ChartErrorState />}
      </Box>
      {size === 'full' && (
        <ClickAwayListener onClickAway={() => setRightAnchorEl(null)}>
          <Box>
            <IconButton
              disableRipple
              onClick={handleToggleMenu}
              sx={{
                p: 0,
                position: 'absolute',
                bottom: 0,
                right: 0,
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
              // Align the menu to the bottom right side of the anchor button.
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
          </Box>
        </ClickAwayListener>
      )}
    </Box>
  );
};

export type SingleAdvancedChartProps = {
  seriesData: ChartQueryData[];
  isLoading?: boolean;
  error?: boolean;
} & OmmitedV2DataProps &
  ChartProps;

const SingleAdvancedChart = (props: SingleAdvancedChartProps) => (
  <Stack position="relative">
    <Stack
      sx={{
        position: 'relative',
        width: '100%',
        height: '250px',
        overflow: 'clip',
      }}
    >
      {/* {!props.seriesData.length && !props.isLoading && !props.error ? (
        <ChartEmptyState />
      ) : ( */}
      <Chart {...props} />
      {/* )} */}
    </Stack>
  </Stack>
);

export default SingleAdvancedChart;
