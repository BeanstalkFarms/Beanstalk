import React, { useCallback, useMemo } from 'react';
import { LinePath, Line } from '@visx/shape';
import { Group } from '@visx/group';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { Axis, Orientation } from '@visx/axis';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import ChartPropProvider, {
  BaseChartProps,
  BaseDataPoint,
  ExploitLine,
  ProviderChartProps,
} from './ChartPropProvider';

type Props = {
  width: number;
  height: number;
} & BaseChartProps &
  ProviderChartProps;

// ------------------------
//      Graph (Inner)
// ------------------------

const Graph: React.FC<Props> = (props) => {
  const {
    // Chart sizing
    stylesConfig,
    // eslint-disable-next-line unused-imports/no-unused-vars
    keys,
    width,
    height,
    // Line Chart Props
    series,
    onCursor,
    isTWAP,
    curve: _curve,
    children,
    getDisplayValue,
    yTickFormat,
    common,
    accessors,
    utils,
  } = props;
  const { getX, getY } = accessors;
  const { generateScale, getCurve, getPointerValue } = utils;

  const curve = useMemo(() => getCurve(_curve), [getCurve, _curve]);

  // Scales
  const scales = useMemo(
    () => generateScale(series, height, width, keys, false, isTWAP),
    [generateScale, height, isTWAP, series, width, keys]
  );

  // tooltip
  const { containerBounds, containerRef } = useTooltipInPortal(
    { scroll: true, detectBounds: true }
  );

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    // eslint-disable-next-line unused-imports/no-unused-vars
    tooltipTop = 0,
    tooltipLeft = 0,
  } = useTooltip<BaseDataPoint[] | undefined>();

  // Handlers
  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    onCursor?.(undefined);
  }, [hideTooltip, onCursor]);

  const handlePointerMove = useCallback(
    (
      event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
    ) => {
      const { left, top } = containerBounds;
      const containerX = ('clientX' in event ? event.clientX : 0) - left;
      const containerY = ('clientY' in event ? event.clientY : 0) - top;
      const pointerData = getPointerValue(event, scales, series);
      showTooltip({
        tooltipData: pointerData,
        tooltipLeft: containerX, // in pixels
        tooltipTop: containerY, // in pixels
      });
      const season = pointerData.length ? pointerData[0].season : undefined;
      onCursor?.(season, getDisplayValue(pointerData));
    },
    [
      containerBounds,
      getPointerValue,
      scales,
      series,
      showTooltip,
      onCursor,
      getDisplayValue,
    ]
  );

  // const yTickNum = height > 180 ? undefined : 5;
  const xTickNum = width > 700 ? undefined : Math.floor(width / 70);
  const xTickFormat = useCallback(
    (v: any) => {
      const d = scales[0].dScale.invert(v);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    [scales]
  );

  const { getStyle } = useMemo(
    () => common.getChartStyles(stylesConfig),
    [common, stylesConfig]
  );

  // Empty state
  if (!series || series.length === 0) return null;

  // Derived
  const tooltipLeftAttached = tooltipData
    ? scales[0].xScale(getX(tooltipData[0]))
    : undefined;

  const dataRegion = {
    yTop: common.margin.top, // chart edge to data region first pixel
    yBottom:
      height - // chart edge to data region first pixel
      common.axisHeight - // chart edge to data region first pixel
      common.margin.bottom, // chart edge to data region first pixel
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
          width={width - common.yAxisWidth}
          height={dataRegion.yBottom - dataRegion.yTop}
        >
          {isTWAP && (
            <Line
              from={{ x: 0, y: scales[0].yScale(1) }}
              to={{ x: width - common.yAxisWidth, y: scales[0].yScale(1) }}
              stroke={BeanstalkPalette.grey}
              strokeWidth={0.5}
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
              stroke={getStyle('', index).stroke}
              strokeWidth={getStyle('', index).strokeWidth}
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
            stroke={common.axisColor}
            tickFormat={xTickFormat}
            tickStroke={common.axisColor}
            tickLabelProps={common.xTickLabelProps}
            numTicks={xTickNum}
          />
        </g>
        <g transform={`translate(${width - 17}, 1)`}>
          <Axis
            key="axis"
            orientation={Orientation.right}
            scale={scales[0].yScale}
            stroke={common.axisColor}
            tickFormat={yTickFormat}
            tickStroke={common.axisColor}
            tickLabelProps={common.yTickLabelProps}
            numTicks={6}
            strokeWidth={0}
          />
        </g>
        {/**
         * Cursor
         */}
        {tooltipData && (
          <>
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
                  key={i}
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
          </>
        )}
      </svg>
    </div>
  );
};

const MultiLineChart: React.FC<BaseChartProps> = (props) => (
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
            {(childProps) => <ExploitLine {...childProps} />}
          </Graph>
        )}
      </ParentSize>
    )}
  </ChartPropProvider>
);

export default MultiLineChart;
