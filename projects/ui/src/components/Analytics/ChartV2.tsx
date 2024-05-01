import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FC } from '~/types';
import { createChart } from 'lightweight-charts';
import { hexToRgba } from '~/util/UI';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useChartSetupData } from './useChartSetupData';
import { BeanstalkPalette } from '../App/muiTheme';
/*
    List of Variables:
    tooltipTitle
    tooltipHoverText
    formattedData (MUST BE IN ASCENDING ORDER)
    extraData (MUST BE IN ASCENDING ORDER)
    priceFormatter
    drawPegLine
    TODO: drawExploitLine (timestamp: 1650196810)
    size
    containerHeight
*/

type ChartV2DataProps = {
  /*
   *
   */
  tooltipTitle: string;
  /*
   *
   */
  tooltipHoverText?: string;
  /*
   *
   */
  formattedData: { time: number; value: number }[][];
  /*
   *
   */
  extraData?: Map<Number, String>;
  /*
   *
   */
  priceFormatter?: (value: number) => string | JSX.Element;
  /*
   *
   */
  drawPegLine?: boolean;
  /*
   *
   */
  size?: "mini" | "full"
  /*
   *
   */
  containerHeight: number;
  /*
   *
   */
  selected: number[];
};


const defaultFormatter = (value: any) => `$${value.toFixed(4)}`;

const ChartV2: FC<ChartV2DataProps> = ({
  tooltipTitle,
  tooltipHoverText,
  formattedData,
  extraData,
  priceFormatter = defaultFormatter,
  drawPegLine,
  size = "full",
  containerHeight,
  selected
}) => {
  const chartContainerRef = useRef<any>();
  const chart = useRef<any>();
  const areaSeries = useRef<any>([]);
  const tooltip = useRef<any>();
  const chartHeight = containerHeight - ((tooltip.current?.clientHeight || 0 ));

  const [lastDataPoint, setLastDataPoint] = useState<any>();
  const [dataPoint, setDataPoint] = useState<any>();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const chartSetupData = useChartSetupData();

  useMemo(() => {
    if (!chartContainerRef.current || !chartHeight) return;
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
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        visible: !(size === 'mini'),
        minBarSpacing: 0.001
      },
      rightPriceScale: {
        borderVisible: false,
        visible: !(size === 'mini')
      },
      leftPriceScale: selected.length < 2 ?  undefined : 
      {
        borderVisible: false,
        visible: !(size === 'mini')
      },
    };

    const handleResize = () => {
      chart.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    const chartColors = [
      {
        lineColor: BeanstalkPalette.logoGreen,
        topColor: hexToRgba(BeanstalkPalette.logoGreen, 0.8),
        bottomColor: hexToRgba(BeanstalkPalette.logoGreen, 0.2),
      },
      {
        lineColor: BeanstalkPalette.blue,
        topColor: hexToRgba(BeanstalkPalette.blue, 0.8),
        bottomColor: hexToRgba(BeanstalkPalette.blue, 0.2),
      },
      {
        lineColor: BeanstalkPalette.washedRed,
        topColor: hexToRgba(BeanstalkPalette.washedRed, 0.8),
        bottomColor: hexToRgba(BeanstalkPalette.washedRed, 0.2),
      },
      {
        lineColor: BeanstalkPalette.yellow,
        topColor: hexToRgba(BeanstalkPalette.yellow, 0.8),
        bottomColor: hexToRgba(BeanstalkPalette.yellow, 0.2),
      },
      {
        lineColor: BeanstalkPalette.yellow,
        topColor: hexToRgba(BeanstalkPalette.yellow, 0.8),
        bottomColor: hexToRgba(BeanstalkPalette.yellow, 0.2),
      }
    ];

    chart.current = createChart(chartContainerRef.current, chartOptions);
    const numberOfCharts = formattedData.length;
    if (numberOfCharts > 0 ) {
      for (let i = 0; i < numberOfCharts; i+=1) {
        areaSeries.current[i] = chart.current.addLineSeries({
          color: chartColors[i].lineColor,
          // topColor: chartColors[i].topColor,
          // bottomColor: chartColors[i].bottomColor,
          lineWidth: 2,
          priceScaleId: i === 0 ? 'right' : i === 1 ? 'left' : '',
          priceFormat: {
            type: 'custom',
            formatter: chartSetupData[selected[i]].tickFormatter
          }
        });
      

        if (drawPegLine) {
          const pegLine = {
            price: 1,
            color: theme.palette.primary.dark,
            lineWidth: 1,
            lineStyle: 3, // LineStyle.Dashed
            axisLabelVisible: false,
            // title: 'line label here',
          };
          areaSeries.current[i].createPriceLine(pegLine);
        };
      };
    };



    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.current.remove();
    };
  }, [theme, drawPegLine, size, chartHeight, formattedData, chartSetupData, selected]);

  useMemo(() => {
    function getMergedData(commonData: { time: Number; value: Number }) {
      const date = commonData
        ? new Date((commonData.time as number) * 1000)
        : null;
      const value = commonData ? commonData.value : null;
      const additionalData =
        extraData && commonData ? extraData.get(commonData.time) : null;
      const formattedDate = date?.toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      return {
        time: formattedDate,
        value: value,
        season: additionalData,
      };
    }

    const numberOfCharts = formattedData.length;
    for (let i = 0; i < numberOfCharts; i+=1) {
      areaSeries.current[i].setData(formattedData[i]);
      chart.current.timeScale().fitContent();
      const lastCommonDataPoint = formattedData[i][formattedData[i].length - 1];
      setLastDataPoint(getMergedData(lastCommonDataPoint));
    };

    // chart.current.subscribeCrosshairMove((param: any) => {
    //  const hoveredDataPoint = param.seriesData.get(areaSeries.current[0]) || null;
    //  setDataPoint(getMergedData(hoveredDataPoint));
    // });

    return () => {
      // chart.current.unsubscribeCrosshairMove();
    };
  }, [formattedData, extraData]);

  return (
    <Box>
      <Box
        ref={tooltip}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          marginTop: 2,
          marginLeft: 2,
          zIndex: 3,
          gap: 0.25,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
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
          {priceFormatter(
            dataPoint && dataPoint.value
              ? dataPoint.value
              : lastDataPoint && lastDataPoint.value
                ? lastDataPoint.value
                : 0
          )}
        </Typography>
        {extraData && (
          <Typography variant="bodySmall" color="text.primary">
            Season{' '}
            {dataPoint && dataPoint.season
              ? dataPoint.season
              : lastDataPoint && lastDataPoint.season
                ? lastDataPoint.season
                : 0}
          </Typography>
        )}
        <Typography variant="bodySmall" color="text.primary">
          {dataPoint && dataPoint.time
            ? dataPoint.time
            : lastDataPoint && lastDataPoint.time
              ? lastDataPoint.time
              : 0}
        </Typography>
      </Box>
      <Box
        ref={chartContainerRef}
        id="container"
        sx={{
          height: chartHeight - 120,
        }}
      />
    </Box>
  );
};

export default ChartV2;
