import { Axis, Orientation, TickFormatter } from '@visx/axis';
import { Line, LinePath } from '@visx/shape';
import { NumberLike, scaleLinear } from '@visx/scale';
import React, { useCallback, useMemo } from 'react';
import {
  curveBasis,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from '@visx/curve';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';

import { CurveFactory } from 'd3-shape';
import { Group } from '@visx/group';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import ChartPropProvider, {
  BaseDataPoint,
  ProviderChartProps,
} from './ChartPropProvider';
import { BeanstalkPalette } from '~/components/App/muiTheme';

// ------------------------
//       Line Chart
// ------------------------

export const CURVES = {
  linear: curveLinear,
  step: curveStep,
  stepAfter: curveStepAfter,
  stepBefore: curveStepBefore,
  natural: curveNatural,
  basis: curveBasis,
  monotoneX: curveMonotoneX,
};

export type Scale = {
  xScale: ReturnType<typeof scaleLinear>;
  yScale: ReturnType<typeof scaleLinear>;
};

export type DataRegion = {
  yTop: number;
  yBottom: number;
};

export type LineChartProps = {
  series: BaseDataPoint[][];
  onCursor?: (ds?: BaseDataPoint[]) => void;
  pegLine?: boolean; // used to display a line at the $1 peg
  isTWAP?: boolean; // used to indicate if we are displaying TWAP price
  curve?: CurveFactory | keyof typeof CURVES;
  children?: (
    props: GraphProps & {
      scales: Scale[];
      dataRegion: DataRegion;
    }
  ) => React.ReactElement | null;
  yTickFormat?: TickFormatter<NumberLike>;
  horizontalLineNumber?: number;
};

type GraphProps = {
  width: number;
  height: number;
} & LineChartProps &
  ProviderChartProps;

// ------------------------
//           Data
// ------------------------

// ------------------------
//      Fonts & Colors
// ------------------------

const strokes = [
  {
    stroke: BeanstalkPalette.theme.spring.beanstalkGreen,
    strokeWidth: 2,
  },
  {
    stroke: BeanstalkPalette.darkBlue,
    strokeWidth: 2,
  },
  {
    stroke: BeanstalkPalette.lightGrey,
    strokeWidth: 0.5,
  },
];

// ------------------------
//      Graph (Inner)
// ------------------------

const Graph: React.FC<GraphProps> = (props) => {
  const {
    // Chart sizing
    width,
    height,
    // Line Chart Props
    series: _series,
    onCursor,
    pegLine,
    isTWAP,
    curve: _curve = 'linear',
    children,
    yTickFormat,
    common,
    accessors,
    utils,
  } = props;
  const {
    margin,
    chartPadding,
    axisHeight,
    axisColor,
    yAxisWidth,
    xTickLabelProps,
    yTickLabelProps,
  } = common;
  const { getX, getY } = accessors;
  const { generateScale, getCurve, getPointerValue } = utils;

  const series = useMemo(
    () => _series as unknown as BaseDataPoint[][],
    [_series]
  );
  const curve = getCurve(_curve);

  // tooltip
  const { containerBounds, containerRef } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  });

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
  } = useTooltip<BaseDataPoint[] | undefined>();

  const scales = useMemo(
    () => generateScale(series, height, width, ['value'], false, isTWAP),
    [height, isTWAP, series, generateScale, width]
  );

  // Handlers
  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    onCursor?.(undefined);
  }, [hideTooltip, onCursor]);

  const handlePointerMove = useCallback(
    (
      event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
    ) => {
      if (series[0].length === 0) return;
      const { left, top } = containerBounds;
      const containerX = ('clientX' in event ? event.clientX : 0) - left;
      const containerY = ('clientY' in event ? event.clientY : 0) - top;
      const pointerData = getPointerValue(event, scales, series);
      showTooltip({
        tooltipData: pointerData,
        tooltipLeft: containerX, // in pixels
        tooltipTop: containerY, // in pixels
      });
      onCursor?.(pointerData as unknown as BaseDataPoint[]);
    },
    [containerBounds, getPointerValue, scales, series, showTooltip, onCursor]
  );

  // const yTickNum = height > 180 ? undefined : 5;
  const xTickNum = width > 700 ? undefined : Math.floor(width / 70);
  const [tickSeasons, tickDates] = useMemo(() => {
    const interval = Math.ceil(
      series[0].length / (width > 700 ? 12 : width < 450 ? 6 : 9)
    );
    const shift = Math.ceil(interval / 3); // slight shift on tick labels
    return series[0].reduce<[number[], string[]]>(
      (prev, curr, i) => {
        if (i % interval === shift) {
          prev[0].push(curr.season);
          prev[1].push(`${curr.date.getMonth() + 1}/${curr.date.getDate()}`);
        }
        return prev;
      },
      [[], []]
    );
  }, [series, width]);

  const xTickFormat = useCallback(
    (_: any, i: number) => tickDates[i],
    [tickDates]
  );

  // Empty state
  if (!series || series.length === 0) return null;

  // Derived
  const tooltipLeftAttached = tooltipData
    ? scales[0].xScale(getX(tooltipData[0]))
    : undefined;
  const dataRegion = {
    yTop: margin.top, // chart edge to data region first pixel
    yBottom:
      height - // chart edge to data region first pixel
      axisHeight - // chart edge to data region first pixel
      margin.bottom, // chart edge to data region first pixel
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          bottom: dataRegion.yTop,
          left: 0,
          width: width - common.yAxisWidth,
          height: dataRegion.yBottom - dataRegion.yTop,
          zIndex: 9,
        }}
        ref={containerRef}
        onTouchStart={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseMove={handlePointerMove}
        onMouseLeave={handleMouseLeave}
      />
      <svg width={width} height={height}>
        {/**
         * Lines
         */}
        <Group
          width={width - yAxisWidth}
          height={dataRegion.yBottom - dataRegion.yTop}
        >
          {(isTWAP || pegLine) && (
            <Line
              from={{ x: 0, y: scales[0].yScale(1) }}
              to={{ x: width - yAxisWidth, y: scales[0].yScale(1) }}
              {...strokes[2]}
            />
          )}
          {children && children({ scales, dataRegion, ...props })}
          {series.map((_data, index) => (
            <LinePath
              key={index}
              curve={curve}
              data={_data}
              x={(d) => scales[index].xScale(getX(d)) ?? 0}
              y={(d) => scales[index].yScale(getY(d)) ?? 0}
              {...strokes[index]}
            />
          ))}
        </Group>
        {/**
         * Axis
         */}
        <g transform={`translate(0, ${dataRegion.yBottom})`}>
          <Axis
            key="axis"
            orientation={Orientation.bottom}
            scale={scales[0].xScale}
            stroke={axisColor}
            tickFormat={xTickFormat}
            tickStroke={axisColor}
            tickLabelProps={xTickLabelProps}
            tickValues={tickSeasons}
          />
        </g>
        <g transform={`translate(${width - chartPadding.right}, 1)`}>
          <Axis
            key="axis"
            orientation={Orientation.right}
            scale={scales[0].yScale}
            stroke={axisColor}
            tickFormat={yTickFormat}
            tickStroke={axisColor}
            tickLabelProps={yTickLabelProps}
            numTicks={6}
            strokeWidth={0}
          />
        </g>
        {/**
         * Cursor
         */}
        {tooltipData && (
          <g>
            <Line
              from={{ x: tooltipLeft, y: dataRegion.yTop }}
              to={{ x: tooltipLeft, y: dataRegion.yBottom }}
              stroke={BeanstalkPalette.lightGrey}
              strokeWidth={1}
              pointerEvents="none"
            />
            {tooltipData.map((td, i) => {
              const tdTop = scales[i].yScale(getY(td));
              return (
                <circle
                  cx={tooltipLeftAttached}
                  cy={tdTop}
                  r={4}
                  fill="black"
                  fillOpacity={0.1}
                  stroke="black"
                  strokeOpacity={0.1}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};

const LineChart: React.FC<LineChartProps> = (props) => (
  <ChartPropProvider>
    {({ ...providerProps }) => (
      <ParentSize debounceTime={50}>
        {({ width: visWidth, height: visHeight }) => (
          <Graph
            width={visWidth}
            height={visHeight}
            {...providerProps}
            {...props}
          >
            {props.children}
          </Graph>
        )}
      </ParentSize>
    )}
  </ChartPropProvider>
);

export default LineChart;
