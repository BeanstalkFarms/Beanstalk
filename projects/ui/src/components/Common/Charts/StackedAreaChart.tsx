import React, { useCallback, useMemo } from 'react';
import { AreaStack, Line, LinePath } from '@visx/shape';
import { Group } from '@visx/group';

import { LinearGradient } from '@visx/gradient';
import BigNumber from 'bignumber.js';
import { Axis, Orientation } from '@visx/axis';
import { useTooltip, useTooltipInPortal, TooltipWithBounds } from '@visx/tooltip';
import { Box, Card, Stack, Typography } from '@mui/material';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { BeanstalkPalette } from '~/components/App/muiTheme';

import { displayBN } from '~/util';
import ChartPropProvider, {
  BaseChartProps,
  BaseDataPoint,
  ProviderChartProps,
} from './ChartPropProvider';
import Row from '../Row';
import { defaultValueFormatter } from './SeasonPlot';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { SILO_WHITELIST } from '~/constants/tokens';

type Props = {
  width: number;
  height: number;
} & BaseChartProps &
  ProviderChartProps;

const Graph = (props: Props) => {
  const siloTokens = useTokenMap(SILO_WHITELIST);
  const {
    // Chart sizing
    width,
    height,
    // props
    series,
    curve: _curve,
    keys,
    tooltip = false,
    isTWAP,
    stylesConfig,
    children,
    onCursor,
    getDisplayValue,
    formatValue = defaultValueFormatter,
    // chart prop provider
    common,
    accessors,
    utils,
  } = props;
  const { getX, getY0, getY, getY1, getYByAsset } = accessors;
  const { generateScale, generatePathFromStack, getPointerValue, getCurve } =
    utils;

  // get curve type
  const curveType = useMemo(() => getCurve(_curve), [_curve, getCurve]);

  // data for stacked area chart will always be T[];
  const data = useMemo(
    () => (series.length && series[0]?.length ? series[0] : []),
    [series]
  );

  // generate scales
  const scales = useMemo(
    () => generateScale(series, height, width, keys, true, isTWAP),
    [generateScale, series, height, width, isTWAP, keys]
  );

  // generate ticks
  const [tickSeasons, tickDates] = useMemo(() => {
    const interval = Math.ceil(data.length / 12);
    const shift = Math.ceil(interval / 3); // slight shift on tick labels
    return data.reduce<[number[], string[]]>(
      (prev, curr, i) => {
        if (i % interval === shift) {
          prev[0].push(curr.season);
          prev[1].push(
            curr.date
              ? `${curr.date.getMonth() + 1}/${curr.date.getDate()}`
              : curr.season.toString() // fallback to season if no date provided
          );
        }
        return prev;
      },
      [[], []]
    );
  }, [data]);

  // tooltip
  const { containerRef, containerBounds } = useTooltipInPortal(
    {
      scroll: true,
      detectBounds: true
    }
  );

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  } = useTooltip<BaseDataPoint | undefined>();

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    onCursor?.(undefined);
  }, [hideTooltip, onCursor]);

  const handlePointerMove = useCallback(
    (
      event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
    ) => {
      const containerX = ('clientX' in event ? event.clientX : 0) - containerBounds.left;
      const containerY = ('clientY' in event ? event.clientY : 0) - containerBounds.top - 10;
      const pointerData = getPointerValue(event, scales, series)[0];

      showTooltip({
        tooltipLeft: containerX,
        tooltipTop: containerY,
        tooltipData: pointerData,
      });
      onCursor?.(pointerData.season, getDisplayValue([pointerData]));
    },
    [containerBounds, getPointerValue, scales, series, showTooltip, onCursor, getDisplayValue]
  );

  // tick format + styles
  const xTickFormat = useCallback((_: any, i: number) => tickDates[i], [tickDates]);
  const yTickFormat = useCallback((val: any) => displayBN(new BigNumber(val)), []);

  // styles are defined in ChartPropProvider as defaultChartStyles
  const { styles, getStyle } = useMemo(() => {
    const { getChartStyles } = common;
    return getChartStyles(stylesConfig);
  }, [common, stylesConfig]);

  if (data.length === 0) return null;

  const dataRegion = {
    yTop: common.margin.top, // chart edge to data region first pixel
    yBottom:
      height - // chart edge to data region first pixel
      common.axisHeight - // chart edge to data region first pixel
      common.margin.bottom - // chart edge to data region first pixel
      common.strokeBuffer,
  };

  /**
   * Gets the Y value for the line that borders
   * the top of each stacked area.
   */
  const getLineHeight = (d: BaseDataPoint, tokenAddr: string) => {
    if (d[tokenAddr] < 0.01) return 0;
    const indexOfToken = keys.indexOf(tokenAddr);
    return keys.reduce<number>((prev, curr, currentIndex) => {
      if (currentIndex <= indexOfToken) {
        prev += d[curr];
        return prev;
      }
      return prev;
    }, 0);
  };

  const reversedKeys = keys.slice().reverse();

  const tooltipLeftAttached = tooltipData ? scales[0].xScale(getX(tooltipData)) : undefined;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group
          width={width - common.yAxisWidth}
          height={dataRegion.yBottom - dataRegion.yTop}
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            rx={14}
          />
          {children && children({ scales, dataRegion, ...props })}
          <AreaStack<BaseDataPoint>
            top={common.margin.top}
            left={common.margin.left}
            keys={keys}
            data={data}
            height={height}
            x={(d) => scales[0].xScale(getX(d.data)) ?? 0}
            y0={(d) => scales[0].yScale(getY0(d)) ?? 0}
            y1={(d) => scales[0].yScale(getY1(d)) ?? 0}
          >
            {({ stacks, path }) =>
              stacks.map((stack, _index) => (
                <Group key={_index}>
                  <LinearGradient
                    to={styles[stack.index]?.to}
                    from={styles[stack.index]?.from}
                    toOpacity={1}
                    fromOpacity={1}
                    id={stack.key.toString()}
                    />
                  <path
                    key={`stack-${stack.key}`}
                    d={path(stack) || ''}
                    stroke="transparent"
                    fill={`url(#${stack.key.toString()})`}
                    />
                  <LinePath<BaseDataPoint>
                    stroke={styles[stack.index]?.stroke}
                    strokeWidth={1}
                    key={`${stack.key.toString()}`}
                    curve={curveType}
                    data={data}
                    x={(d) => scales[0].xScale(getX(d)) ?? 0}
                    y={(d) => scales[0].yScale(getLineHeight(d, stack.key.toString())) ?? 0}
                    />
                </Group>
              )
            )}
          </AreaStack>
        </Group>
        <g transform={`translate(0, ${dataRegion.yBottom})`}>
          <Axis
            key="axis"
            orientation={Orientation.bottom}
            scale={scales[0].xScale}
            stroke={common.axisColor}
            tickFormat={xTickFormat}
            tickStroke={common.axisColor}
            tickLabelProps={common.xTickLabelProps}
            tickValues={tickSeasons}
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
        {tooltipData && (
          <Group>
            <Line
              from={{ x: tooltipLeft, y: dataRegion.yTop }}
              to={{ x: tooltipLeft, y: dataRegion.yBottom }}
              stroke={BeanstalkPalette.lightGrey}
              strokeWidth={1}
              pointerEvents="none"
            />
            {reversedKeys.map((key, index) => {
              const lenKeys = keys.length;
              return (
                <circle
                  key={index}
                  cx={tooltipLeftAttached}
                  cy={scales[0].yScale(getLineHeight(tooltipData, key)) ?? 0}
                  r={lenKeys === 1 ? 4 : 2}
                  fill={lenKeys === 1 ? 'black' : getStyle(key, reversedKeys.length - index - 1).to}
                  fillOpacity={lenKeys === 1 ? 0.1 : 0.4}
                  stroke={lenKeys === 1 ? 'black' : getStyle(key, reversedKeys.length - index - 1).stroke}
                  strokeOpacity={lenKeys === 1 ? 0.1 : 0.4}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
          </Group>
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: dataRegion.yTop,
          left: 0,
          width: width - common.yAxisWidth,
          height: dataRegion.yBottom,
          zIndex: 9,
        }}
        ref={containerRef}
        onTouchStart={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseMove={handlePointerMove}
        onMouseLeave={handleMouseLeave}
      >
        {tooltipData && (
          <Group>
            <Line
              from={{ x: tooltipLeft, y: dataRegion.yTop }}
              to={{ x: tooltipLeft, y: dataRegion.yBottom }}
              stroke={BeanstalkPalette.lightGrey}
              strokeWidth={1}
              pointerEvents="none"
            />
            {tooltip ? (
              <div>
                <TooltipWithBounds
                  key={Math.random()}
                  left={tooltipLeft}
                  top={tooltipTop}
                  style={{
                    width: 'fit-content',
                    position: 'absolute'
                  }}
                >
                  <Card sx={{ p: 1, backgroundColor: BeanstalkPalette.lightestBlue, border: '1px solid', borderColor: 'divider' }}>
                    {typeof tooltip === 'boolean' ? (
                      <Stack gap={0.5}>
                        {reversedKeys.map((key, index) => (
                          <Row key={index} justifyContent="space-between" gap={3}>
                            <Row gap={1}>
                              <Box
                                sx={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: getStyle(key, reversedKeys.length - index - 1).to,
                                  border: 1,
                                  borderColor: getStyle(key, reversedKeys.length - index - 1).stroke
                                }}
                              />
                              <Typography>{siloTokens[key]?.symbol}</Typography>
                            </Row>
                            <Typography textAlign="right">
                              {formatValue(tooltipData[key])}
                            </Typography>
                          </Row>
                        ))}
                      </Stack>
                    ) : (
                      tooltip({ d: [tooltipData] })
                    )}
                  </Card>
                </TooltipWithBounds>
              </div>
            ) : null}
          </Group>
        )}
      </div>
    </div>
  );
};

// For reference on how to use this chart, refer to BeanVs3Crv.tsx
const StackedAreaChart: React.FC<BaseChartProps> = (props) => (
  <ChartPropProvider>
    {({ ...providerProps }) => (
      <ParentSize debounceTime={50}>
        {({ width: visWidth, height: visHeight }) => (
          <Graph
            width={visWidth}
            height={visHeight}
            {...providerProps}
            {...props}
          />
        )}
      </ParentSize>
    )}
  </ChartPropProvider>
);

export default StackedAreaChart;
