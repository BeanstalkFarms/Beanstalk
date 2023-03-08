import { CurveFactory, Series } from 'd3-shape';
import { NumberLike, scaleLinear, scaleLog, scaleTime } from '@visx/scale';
import React, { useMemo } from 'react';
import { ScaleLinear, ScaleTime } from 'd3-scale';
import { bisector, extent, max, min } from 'd3-array';
import {
  curveBasis,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from '@visx/curve';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { Line } from '@visx/shape';
import { SeriesPoint } from '@visx/shape/lib/types';
import { TickFormatter } from '@visx/axis';
import { localPoint } from '@visx/event';

// -------------------------------------------------------------------------
// --------------------------------- TYPES ---------------------------------
// -------------------------------------------------------------------------

export type BaseDataPoint = {
  season: number;
  date: Date;
  value: number;
} & {
  [key: string]: number;
};

export type ChartMultiStyles = {
  [key: string]: {
    stroke: string; // stroke color
    fillPrimary: string; // gradient 'to' color
    fillSecondary?: string; // gradient 'from' color
    strokeWidth?: number;
  };
};

type ChartStyleConfig = {
  // id: string;
  to: string;
  from: string;
  stroke: string;
  strokeWidth: number;
};

type ChartSharedValuesProps = {
  strokeBuffer: number;
  margin: { top: number; bottom: number; left: number; right: number };
  chartPadding: { right: number };
  axisColor: string;
  axisHeight: number;
  backgroundColor: string;
  labelColor: string;
  tickLabelColor: string;
  yAxisWidth: number;
  defaultChartStyles: ChartMultiStyles;
  yTickLabelProps: typeof yTickLabelProps;
  xTickLabelProps: typeof xTickLabelProps;
  getChartStyles: (config?: ChartMultiStyles) => {
    getStyle: (k: string, i: number) => ChartStyleConfig;
    styles: ChartStyleConfig[];
  };
};

type Scales = {
  xScale: ScaleLinear<number, number, never>;
  dScale: ScaleTime<number, number, never>;
  yScale: ScaleLinear<number, number, never>;
};

export type Scale = {
  xScale: ReturnType<typeof SCALES[keyof typeof SCALES]>;
  yScale: ReturnType<typeof SCALES[keyof typeof SCALES]>;
};

type ChartAccessorProps = {
  getX: (d: BaseDataPoint) => number;
  getD: (d: BaseDataPoint) => Date;
  getY: (d: BaseDataPoint) => number;
  getYByAsset: (d: BaseDataPoint, asset: string) => number;
  getY0: (d: SeriesPoint<BaseDataPoint>) => number;
  getY1: (d: SeriesPoint<BaseDataPoint>) => number;
  getYMin: (d: BaseDataPoint) => number;
  getYMax: (d: BaseDataPoint) => number;
  bisectSeason: (
    array: ArrayLike<BaseDataPoint>,
    x: number,
    lo?: number | undefined,
    hi?: number | undefined
  ) => number;
};

type UtilProps = {
  generatePathFromStack: <K extends keyof BaseDataPoint>(
    data: Series<BaseDataPoint, K>
  ) => BaseDataPoint[];
  generateScale: (
    seriesData: BaseDataPoint[][],
    height: number,
    width: number,
    keys: string[],
    stackedArea?: boolean,
    isTWAP?: boolean
  ) => Scales[];
  getPointerValue: (
    event:
      | React.TouchEvent<HTMLDivElement>
      | React.MouseEvent<HTMLDivElement, MouseEvent>,
    scales: Scales[],
    data: BaseDataPoint[][]
  ) => BaseDataPoint[];
  getCurve: (curve?: keyof typeof CURVES | CurveFactory) => CurveFactory;
};

export type DataRegion = { yTop: number; yBottom: number };
export type BaseGraphProps = { width: number; height: number };

export type ProviderChartProps = {
  common: ChartSharedValuesProps;
  accessors: ChartAccessorProps;
  utils: UtilProps;
};

export type ChartChildParams = BaseGraphProps & {
  scales: Scale[];
  dataRegion: DataRegion;
};

export type BaseChartProps = {
  series: BaseDataPoint[][];
  keys: string[];
  curve?: CurveFactory | keyof typeof CURVES;
  scale?: keyof typeof SCALES;
  isTWAP?: boolean;
  horizontalLineNumber?: number;
  stylesConfig?: ChartMultiStyles;
  stackedArea?: boolean;
  tooltip?: boolean | (({ d }: { d?: BaseDataPoint[] }) => JSX.Element | null);
  getDisplayValue: (v: BaseDataPoint[]) => number;
  onCursor?: (season: number | undefined, v?: number | undefined) => void;
  children?: (props: ChartChildParams) => React.ReactElement | null;
  yTickFormat?: TickFormatter<NumberLike>;
  formatValue?: (value: number) => string | JSX.Element;
};

// -------------------------------------------------------------------------
// -------------------------------- COMMON ---------------------------------
// -------------------------------------------------------------------------

// shared parameters across stacked area and line charts
const strokeBuffer = 2;
const axisHeight = 21;
const backgroundColor = '#da7cff';
const labelColor = '#340098';
const tickLabelColor = BeanstalkPalette.lightGrey;
const axisColor = BeanstalkPalette.lightGrey;
const yAxisWidth = 57;

const margin = {
  top: 10,
  bottom: 9,
  left: 0,
  right: 0,
};

const chartPadding = {
  right: 17,
};

const chartColors = BeanstalkPalette.theme.winter.chart;
const defaultChartStyles: ChartMultiStyles = {
  0: {
    stroke: BeanstalkPalette.theme.winter.primary,
    fillPrimary: chartColors.primaryLight,
    strokeWidth: 2,
  },
  1: {
    stroke: chartColors.purple,
    fillPrimary: chartColors.purpleLight,
    strokeWidth: 2,
  },
  2: {
    stroke: chartColors.green,
    fillPrimary: chartColors.greenLight,
    strokeWidth: 2,
  },
  3: {
    stroke: chartColors.yellow,
    fillPrimary: chartColors.yellowLight,
    strokeWidth: 2,
  },
};

/**
 * get chart styles for given key
 */
const getChartStyles = (config?: ChartMultiStyles) => {
  const style = config ?? defaultChartStyles;
  const styles = Object.entries(style).map(
    ([k, { stroke, fillPrimary, fillSecondary, strokeWidth }]) => {
      const primary = fillPrimary || stroke;
      const secondary = fillSecondary || fillPrimary;
      const _strokeWidth = strokeWidth ?? 2;
      return {
        id: k,
        to: primary,
        from: secondary,
        stroke,
        strokeWidth: _strokeWidth,
      };
    }
  );
  const getStyle = (k: string, i: number) => {
    const _style = styles.find((s) => s.id === k);
    return _style || styles[Math.floor(i % styles.length)];
  };
  return { getStyle, styles };
};

const xTickLabelProps = () =>
  ({
    fill: tickLabelColor,
    fontSize: 12,
    fontFamily: 'Futura PT',
    textAnchor: 'middle',
  } as const);

const yTickLabelProps = () =>
  ({
    fill: tickLabelColor,
    fontSize: 12,
    fontFamily: 'Futura PT',
    textAnchor: 'end',
  } as const);

/**
 * chart curve types
 */
export const CURVES = {
  linear: curveLinear,
  step: curveStep,
  stepAfter: curveStepAfter,
  stepBefore: curveStepBefore,
  natural: curveNatural,
  basis: curveBasis,
  monotoneX: curveMonotoneX,
};

/**
 * chart scale types
 */
export const SCALES = {
  linear: scaleLinear,
  time: scaleTime,
  log: scaleLog,
};

// -------------------------------------------------------------------------
// ------------------------------- ACCESSORS -------------------------------
// -------------------------------------------------------------------------

/**
 * d3.js method for finding position in an array of BaseDataPoints
 * where data.season = k, such that k is the season being searched.
 * If more than value satisfies data.season = k, the lowest index
 * of the search results will be used
 */
const bisectSeason = bisector<BaseDataPoint, number>((d) => d.season).left;

/**
 * access 'season' property given from a BaseDataPoint
 */
const getX = (d: BaseDataPoint) => d.season;

/**
 * access 'value' property from BaseDataPoint
 * (currently line charts only)
 */
const getY = (d: BaseDataPoint) => d.value;

/**
 * Gets the Y value for a specific stack in a stacked area chart.
 */
const getYByAsset = (d: BaseDataPoint, asset: string) =>
  d[asset] ? d[asset] : 0;

/**
 * access 'date' property from BaseDataPoint
 * (currently line charts only)
 */
const getD = (d: BaseDataPoint) => d.date;

/**
 * access the bottom Y value of a generated stack series point.
 * (stacked area charts only)
 */
const getY0 = (d: SeriesPoint<BaseDataPoint>) => {
  const d0 = d[0];
  return !d0 || Number.isNaN(d0) || !Number.isFinite(d0) ? 0 : d0;
};

/**
 * access the upper Y value of a generated stack series point.
 * (stacked area charts only)
 */
const getY1 = (d: SeriesPoint<BaseDataPoint>) => {
  const d1 = d[1];
  return !d1 || Number.isNaN(d1) || !Number.isFinite(d1) ? 0 : d1;
};

const baseDataPoint = {
  season: true,
  date: true,
  createdAt: true,
} as const;

/**
 * returns the minimum value amongst relavent keys of a BaseDataPoint
 * to assist in generating yScale (stacked area charts only)
 */
const getYMin = (d: BaseDataPoint) =>
  Object.entries(d).reduce((acc, [k, v]) => {
    if (k in baseDataPoint) return acc;
    return Math.min(acc, v as number);
  }, Infinity);

/**
 * calculates yDomain.domain[0] of stacked area data.
 * Returns the minimum value of a key with the largest collective sum
 */
type YDomainCache = { cum: number; lowest: number };
const getStackedAreaYDomainMin = (data: BaseDataPoint[], keys: string[]) => {
  const start = { cum: 0, lowest: Infinity };
  const map = new Map<string, YDomainCache>(
    keys.map((key) => [key, start] as [string, YDomainCache])
  );
  data.forEach((d) => {
    keys.forEach((k) => {
      if (k in d) {
        const curr = k in d ? d[k] : 0;
        const stored = map.get(k);
        if (stored) {
          map.set(k, {
            cum: stored.cum + curr,
            lowest: curr !== 0 ? Math.min(stored.lowest, curr) : stored.lowest,
          });
        }
      }
    });
  });
  let cache = { cum: 0, lowest: Infinity };
  Array.from(map.entries()).forEach(([_k, { cum, lowest }]) => {
    if (!cache.cum) {
      cache = { cum, lowest };
    } else if (cum > cache.cum) {
      cache = { cum, lowest };
    }
  });
  return !Number.isFinite(cache.lowest) ? 0 : cache.lowest;
};

/**
 * returns the maximum value amongst relevant keys of a BaseDataPoint
 * to assist in generating yScale (stacked area charts only)
 */
const getYMax = (d: BaseDataPoint) =>
  Object.entries(d).reduce((acc, [k, v]) => {
    if (k in baseDataPoint) return acc;
    acc += v as number;
    return acc;
  }, 0);

// -------------------------------------------------------------------------
// ------------------------------ CHART UTILS ------------------------------
// -------------------------------------------------------------------------

const generateScale = (
  seriesData: BaseDataPoint[][],
  height: number,
  width: number,
  keys: string[],
  isStackedArea?: boolean,
  isTWAP?: boolean
) =>
  seriesData.map((data) => {
    // Generate xScale
    const xDomain = extent(data, getX) as [number, number];
    const xScale = scaleLinear<number>({ domain: xDomain });

    // Generate dScale (only for non-stacked Area charts)
    const dScale = scaleTime() as ScaleTime<number, number, never>;
    if (!isStackedArea) {
      dScale.domain(extent(data, getD) as [Date, Date]);
      dScale.range(xDomain);
    }

    // Generate yScale
    let yScale;
    if (isTWAP) {
      const yMin = min(data, getY) as number;
      const yMax = max(data, getY) as number;
      const biggestDifference = Math.max(
        Math.abs(1 - yMin),
        Math.abs(1 - yMax)
      );
      const M = 5;

      // TWAP: floor at 0, max at 1.2 * highest price
      yScale = scaleLinear<number>({
        domain: [
          Math.max(1 - biggestDifference * M, 0),
          Math.min(1 + biggestDifference * M, 1.2 * yMax),
        ],
      });
    } else if (isStackedArea) {
      yScale = scaleLinear<number>({
        clamp: true,
        domain: [0, 1.05 * (max(data, getY) as number)],
      });
    } else {
      const yMin = min(data, getY) as number;
      const yMax = max(data, getY) as number;
      const M = [0.998, 1.002];

      yScale = scaleLinear<number>({
        clamp: false,
        domain: [
          yMin * (yMin < 0 ? M[1] : M[0]),
          yMax * (yMax < 0 ? M[0] : M[1]),
        ],
      });
    }

    // Set range for xScale
    xScale.range([0, width - yAxisWidth]);

    // Set range for yScale
    yScale.range([
      height - axisHeight - margin.bottom - strokeBuffer, // bottom edge
      margin.top,
    ]);

    return { xScale, dScale, yScale };
  });

/**
 * return value on chart given scales and pointer/touch position
 */
const getPointerValue = (
  event:
    | React.TouchEvent<HTMLDivElement>
    | React.MouseEvent<HTMLDivElement, MouseEvent>,
  scales: Scales[],
  series: BaseDataPoint[][]
) => {
  const data = series[0];
  return scales.map((scale, i) => {
    const { x } = localPoint(event) || { x: 0 };
    const x0 = scale.xScale.invert(x);
    const index = bisectSeason(data, x0, 1);
    const d0 = series[i][index - 1]; // value at x0 - 1
    const d1 = series[i][index]; // value at x0
    return (() => {
      if (d1 && getX(d1)) {
        return x0.valueOf() - getX(d0).valueOf() >
          getX(d1).valueOf() - x0.valueOf()
          ? d1
          : d0;
      }
      return d0;
    })();
  });
};

/**
 * generates data from generated stack data such that a LinePath can be drawn
 */
const generatePathFromStack = <K extends keyof BaseDataPoint>(
  data: Series<BaseDataPoint, K>
) =>
  data.map((stack: SeriesPoint<BaseDataPoint>) => ({
    season: stack.data.season,
    date: stack.data.date,
    value: getY1(stack) ?? 0,
  })) as unknown as BaseDataPoint[];

/**
 * returns the curve to be used for a given chart.
 */
const getCurve = (curve?: keyof typeof CURVES | CurveFactory): CurveFactory => {
  if (!curve) return CURVES.linear;
  if (typeof curve === 'string') {
    return CURVES[curve];
  }
  return curve;
};

/**
 * returns scale type to be use for a given chart
 */
// eslint-disable-next-line unused-imports/no-unused-vars
const getScale = (scale?: keyof typeof SCALES) => {
  if (!scale) return SCALES.linear;
  return SCALES[scale];
};

// -------------------------------------------------------------------------
// ------------------------------- COMPONENT -------------------------------
// -------------------------------------------------------------------------

type ChartWrapperProps = {
  children: (props: ProviderChartProps) => React.ReactNode;
};

export const chartHelpers: ProviderChartProps = {
  common: {
    strokeBuffer,
    margin,
    chartPadding,
    axisHeight,
    backgroundColor,
    labelColor,
    axisColor,
    tickLabelColor,
    yAxisWidth,
    defaultChartStyles,
    xTickLabelProps,
    yTickLabelProps,
    getChartStyles,
  },
  accessors: {
    getX,
    getY,
    getYByAsset,
    getD,
    getY0,
    getY1,
    bisectSeason,
    getYMin,
    getYMax,
  },
  utils: {
    generatePathFromStack,
    generateScale,
    getPointerValue,
    getCurve,
  },
};

/**
 * hook used to access commonly used chart functions and values
 */
const ChartPropProvider: React.FC<ChartWrapperProps> = ({ children }) => {
  const props = useMemo(() => chartHelpers, []);
  return (
    <>
      {children({
        ...props,
      })}
    </>
  );
};

export default ChartPropProvider;

/**
 * Adds a horizontal line at Season 6074.
 */
export const ExploitLine = (props: ChartChildParams) => {
  if (!props.scales.length) return null;
  const exploitSeason = props.scales[0].xScale(6074) as number;
  return exploitSeason ? (
    <Line
      from={{ x: exploitSeason, y: props.dataRegion.yTop }}
      to={{ x: exploitSeason, y: props.dataRegion.yBottom }}
      stroke={BeanstalkPalette.logoGreen}
      strokeDasharray={4}
      strokeDashoffset={2}
      strokeWidth={1}
    />
  ) : null;
};
