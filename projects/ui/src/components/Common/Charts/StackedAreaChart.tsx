/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useCallback, useEffect, useMemo } from 'react';
import { AreaStack, Line, LinePath } from '@visx/shape';
import { Group } from '@visx/group';

import { LinearGradient } from '@visx/gradient';
import BigNumber from 'bignumber.js';
import { Axis, Orientation } from '@visx/axis';
import {
  useTooltip,
  useTooltipInPortal,
  TooltipWithBounds,
} from '@visx/tooltip';
import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { displayBN, toSeasonNumber } from '~/util';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { SILO_WHITELIST } from '~/constants/tokens';
import {
  BaseChartProps,
  BaseDataPoint,
  ChartStyleConfig,
  Scales,
  chartHelpers,
} from './ChartPropProvider';
import Row from '../Row';
import { defaultValueFormatter } from './SeasonPlot';

type Props = {
  width: number;
  height: number;
} & BaseChartProps;

const {
  common: {
    margin,
    axisHeight,
    strokeBuffer,
    yAxisWidth,
    axisColor,
    xTickLabelProps,
    yTickLabelProps,
    getChartStyles,
  },
  accessors: { getX, getY0, getY1 },
  utils: { generateScale, getPointerValue, getCurve },
} = chartHelpers;

const Graph = (props: Props) => {
  const {
    // Chart sizing
    width,
    height,
    // props
    series,
    curve: _curve,
    keys,
    isTWAP,
    stylesConfig,
    children,
  } = props;
  // const { getX, getY0, getY1 } = accessors;
  // const { generateScale, getPointerValue, getCurve } = utils;

  // get curve type
  const curveType = useMemo(() => getCurve(_curve), [_curve]);

  // data for stacked area chart will always be T[];
  const data = useMemo(
    () => (series.length && series[0]?.length ? series[0] : []),
    [series]
  );

  // generate scales
  const scales = useMemo(
    () => generateScale(series, height, width, keys, true, isTWAP),
    [series, height, width, isTWAP, keys]
  );

  // generate ticks
  const [tickSeasons, tickDates] = useMemo(() => {
    const interval = Math.ceil(
      series[0].length / (width > 700 ? 12 : width < 450 ? 6 : 9)
    );
    const shift = Math.ceil(interval / 3); // slight shift on tick labels
    return data.reduce<[number[], string[]]>(
      (prev, curr, i) => {
        if (i % interval === shift) {
          const seasonNum = toSeasonNumber(curr.season);
          prev[0].push(seasonNum);
          prev[1].push(
            curr.date
              ? `${curr.date.getMonth() + 1}/${curr.date.getDate()}`
              : String(seasonNum) // fallback to season if no date provided
          );
        }
        return prev;
      },
      [[], []]
    );
  }, [data, series, width]);

  // tooltip
  const { containerRef, containerBounds, forceRefreshBounds } =
    useTooltipInPortal({
      scroll: true,
      detectBounds: true,
    });

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  } = useTooltip<BaseDataPoint | undefined>();

  useEffect(() => {
    forceRefreshBounds();
  }, [forceRefreshBounds]);

  // tick format + styles
  const xTickFormat = useCallback(
    (_: any, i: number) => tickDates[i],
    [tickDates]
  );
  const yTickFormat = useCallback(
    (val: any) => displayBN(new BigNumber(val)),
    []
  );

  // styles are defined in ChartPropProvider as defaultChartStyles
  const { styles, getStyle } = useMemo(
    () => getChartStyles(stylesConfig),
    [stylesConfig]
  );

  const dataRegion = useMemo(
    () => ({
      yTop: margin.top, // chart edge to data region first pixel
      yBottom:
        height - // chart edge to data region first pixel
        axisHeight - // chart edge to data region first pixel
        margin.bottom - // chart edge to data region first pixel
        strokeBuffer,
    }),
    [height]
  );

  const reversedKeys = useMemo(() => keys.slice().reverse(), [keys]);

  /**
   * Gets the Y value for the line that borders
   * the top of each stacked area.
   */
  const getLineHeight = useCallback(
    (d: BaseDataPoint, tokenAddr: string) => {
      if (d[tokenAddr] < 0.01) return 0;
      const indexOfToken = keys.indexOf(tokenAddr);
      return keys.reduce<number>((prev, curr, currentIndex) => {
        if (currentIndex <= indexOfToken) {
          prev += d[curr];
          return prev;
        }
        return prev;
      }, 0);
    },
    [keys]
  );

  const tooltipLeftAttached = useMemo(
    () => (tooltipData ? scales[0].xScale(getX(tooltipData)) : undefined),
    [tooltipData, scales]
  );

  if (data.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group
          width={width - yAxisWidth}
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
            top={margin.top}
            left={margin.left}
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
                    y={(d) =>
                      scales[0].yScale(
                        getLineHeight(d, stack.key.toString())
                      ) ?? 0
                    }
                  />
                </Group>
              ))
            }
          </AreaStack>
        </Group>
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
        <g transform={`translate(${width - 17}, 1)`}>
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
        {tooltipData && (
          <TooltipItem
            reversedKeys={reversedKeys}
            keys={keys}
            tooltipLeft={tooltipLeft}
            dataRegion={dataRegion}
            tooltipLeftAttached={tooltipLeftAttached}
            scales={scales}
            tooltipData={tooltipData}
            getStyle={getStyle}
            getLineHeight={getLineHeight}
          />
        )}
      </svg>
      <TooltipComponent
        {...props}
        containerRef={containerRef}
        containerBounds={containerBounds}
        forceRefreshBounds={forceRefreshBounds}
        showTooltip={showTooltip}
        hideTooltip={hideTooltip}
        tooltipData={tooltipData}
        tooltipLeft={tooltipLeft}
        tooltipTop={tooltipTop}
        dataRegion={dataRegion}
        width={width}
        reversedKeys={reversedKeys}
        getStyle={getStyle}
        scales={scales}
        series={series}
      />
    </div>
  );
};

// For reference on how to use this chart, refer to BeanVs3Crv.tsx
const StackedAreaChart: React.FC<BaseChartProps> = (props) => (
  <ParentSize debounceTime={50}>
    {({ width: visWidth, height: visHeight }) => (
      <Graph width={visWidth} height={visHeight} {...props} />
    )}
  </ParentSize>
);

export default StackedAreaChart;

// ---------- Helper Functions ----------

type ITooltipComponentRaw = Pick<
  BaseChartProps,
  | 'tooltip'
  | 'useCustomTokenList'
  | 'tokenPerSeasonFilter'
  | 'useCustomTooltipNames'
  | 'formatValue'
  | 'getDisplayValue'
  | 'onCursor'
>;

function TooltipComponentRaw({
  dataRegion,
  width,
  reversedKeys,
  useCustomTooltipNames,
  tooltip = false,
  scales,
  series,
  tooltipData,
  tooltipLeft = 0,
  tooltipTop = 0,
  useCustomTokenList,
  tokenPerSeasonFilter,
  containerBounds,
  getDisplayValue,
  getStyle,
  onCursor,
  showTooltip,
  containerRef,
  hideTooltip,
  formatValue = defaultValueFormatter,
  forceRefreshBounds,
}: {
  width: number;
  dataRegion: {
    yTop: number;
    yBottom: number;
  };
  reversedKeys: string[];
  getStyle: (k: string, i: number) => ChartStyleConfig;
  scales: Scales[];
  series: BaseDataPoint[][];
} & ITooltipComponentRaw &
  Pick<
    ReturnType<typeof useTooltip<BaseDataPoint | undefined>>,
    'showTooltip' | 'hideTooltip' | 'tooltipData' | 'tooltipTop' | 'tooltipLeft'
  > &
  Pick<
    ReturnType<typeof useTooltipInPortal>,
    'containerRef' | 'containerBounds' | 'forceRefreshBounds'
  >) {
  const theme = useTheme();
  const siloTokens = useTokenMap(useCustomTokenList || SILO_WHITELIST);
  const tooltipPadding = 1;

  // Calculate tooltip height based on visible data items
  const calculateTooltipHeight = useCallback(
    (data: BaseDataPoint) => {
      let visibleItems = 0;
      const seasonNum = toSeasonNumber(data.season);
      reversedKeys.forEach((key) => {
        const seasonFilter = tokenPerSeasonFilter;
        if (
          !seasonFilter ||
          (seasonNum >= seasonFilter[key]?.from &&
            seasonNum <= seasonFilter[key]?.to)
        ) {
          visibleItems += 1;
        }
      });

      // Base height = Card padding + (item height * number of items)
      return parseInt(theme.spacing(tooltipPadding), 10) + visibleItems * 25; // base, 25px per item
    },
    [reversedKeys, tokenPerSeasonFilter, theme]
  );

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    onCursor?.(undefined);
  }, [hideTooltip, onCursor]);

  const handlePointerMove = useCallback(
    (
      event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
    ) => {
      if (series[0].length === 0) return;
      forceRefreshBounds();
      const containerX =
        ('clientX' in event ? event.clientX : 0) - containerBounds.left;
      const rawContainerY =
        ('clientY' in event ? event.clientY : 0) - containerBounds.top - 10;

      const pointerData = getPointerValue(event, scales, series)[0];
      const tooltipHeight = calculateTooltipHeight(pointerData);
      const containerY = Math.max(
        0,
        Math.min(rawContainerY, containerBounds.height - tooltipHeight - 20)
      );

      showTooltip({
        tooltipLeft: containerX,
        tooltipTop: containerY,
        tooltipData: pointerData,
      });

      onCursor?.(
        toSeasonNumber(pointerData.season),
        getDisplayValue([pointerData]),
        pointerData.date,
        pointerData
      );
    },
    [
      containerBounds,
      forceRefreshBounds,
      scales,
      series,
      showTooltip,
      onCursor,
      getDisplayValue,
      calculateTooltipHeight,
    ]
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: dataRegion.yTop,
        left: 0,
        width: width - yAxisWidth,
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
                  position: 'absolute',
                }}
              >
                <Card
                  sx={{
                    p: tooltipPadding,
                    backgroundColor: BeanstalkPalette.lightestBlue,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {typeof tooltip === 'boolean' ? (
                    <Stack gap={0.5}>
                      {reversedKeys.map((key, index) => {
                        const seasonFilter = tokenPerSeasonFilter;
                        if (
                          !seasonFilter ||
                          (toSeasonNumber(tooltipData.season) >=
                            seasonFilter[key]?.from &&
                            toSeasonNumber(tooltipData.season) <=
                              seasonFilter[key]?.to)
                        ) {
                          return (
                            <Row
                              key={index}
                              justifyContent="space-between"
                              gap={3}
                            >
                              <Row gap={1}>
                                <Box
                                  sx={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: getStyle(
                                      key,
                                      reversedKeys.length - index - 1
                                    ).to,
                                    border: 1,
                                    borderColor: getStyle(
                                      key,
                                      reversedKeys.length - index - 1
                                    ).stroke,
                                  }}
                                />
                                <Typography>
                                  {useCustomTooltipNames
                                    ? useCustomTooltipNames[key]
                                    : siloTokens[key]?.symbol}
                                </Typography>
                              </Row>
                              <Typography textAlign="right">
                                {formatValue(tooltipData[key])}
                              </Typography>
                            </Row>
                          );
                        }
                        return null;
                      })}
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
  );
}

function TooltipItemNonMemoized({
  reversedKeys,
  keys,
  tooltipLeft,
  dataRegion,
  tooltipLeftAttached,
  scales,
  tooltipData,
  getStyle,
  getLineHeight,
}: {
  reversedKeys: string[];
  keys: string[];
  tooltipLeft: number;
  dataRegion: {
    yTop: number;
    yBottom: number;
  };
  tooltipLeftAttached: number | undefined;
  scales: Scales[];
  tooltipData: BaseDataPoint;
  getStyle: (k: string, i: number) => ChartStyleConfig;
  getLineHeight: (d: BaseDataPoint, tokenAddr: string) => number;
}) {
  return (
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
            fill={
              lenKeys === 1
                ? 'black'
                : getStyle(key, reversedKeys.length - index - 1).to
            }
            fillOpacity={lenKeys === 1 ? 0.1 : 0.4}
            stroke={
              lenKeys === 1
                ? 'black'
                : getStyle(key, reversedKeys.length - index - 1).stroke
            }
            strokeOpacity={lenKeys === 1 ? 0.1 : 0.4}
            strokeWidth={2}
            pointerEvents="none"
          />
        );
      })}
    </Group>
  );
}

const TooltipItem = React.memo(TooltipItemNonMemoized);

const TooltipComponent = React.memo(TooltipComponentRaw);
