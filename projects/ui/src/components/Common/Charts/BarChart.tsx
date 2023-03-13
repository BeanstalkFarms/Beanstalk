import { Axis, Orientation } from '@visx/axis';
import React, { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';

import { BarRounded } from '@visx/shape';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { Group } from '@visx/group';
import { chartHelpers } from './ChartPropProvider';
import { withTooltip } from '@visx/tooltip';

const {
  common: {
    axisColor,
    axisHeight,
    yAxisWidth,
    xTickLabelProps,
    yTickLabelProps,
    margin,
    chartPadding,
  },
} = chartHelpers;

type BarChartHookParams = {
  seriesData: any[];
  chartWidth: number;
  chartHeight: number;
  getX: (datum: object) => string;
  getY: (datum: object) => number;
  xTickFormat: (datum: any) => string;
  yTickFormat: (datum: any) => string;
};

const useBarChart = ({
  seriesData,
  chartWidth,
  chartHeight,
  getX,
  getY,
  xTickFormat,
  yTickFormat,
}: BarChartHookParams) => {
  const xMax = chartWidth - yAxisWidth;
  const yMax = chartHeight - axisHeight - margin.bottom;
  const yMaxDomain = Math.max(...seriesData.map(getY));

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        round: true,
        domain: seriesData.map(getX),
        padding: 0.4,
      }),
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xMax, seriesData]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        round: true,
        domain: [0, yMaxDomain * 1.2],
      }),
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yMax, yMaxDomain, seriesData]
  );

  const Bar = useMemo(
    () => {
      const BarComponent: React.FC<{
        datum: object;
        isActive: boolean;
        onBarHoverEnter: (datum: object) => void;
        onBarHoverLeave: (datum: object) => void;
      }> = ({ datum, isActive = false, onBarHoverEnter, onBarHoverLeave }) => {
        const x = getX(datum);
        const barWidth = xScale.bandwidth();
        const barHeight = yMax - (yScale(getY(datum)) ?? 0);
        const xPosition = xScale(x) ?? 0;
        const yPosition = yMax - barHeight;

        const fillColor = isActive ? 'rgba(0, 0, 0, 0.08)' : 'transparent';
        const additionalHoverBarWidth = Math.round(barWidth * 0.3);
        return (
          <>
            <BarRounded
              key={`bar-${x}`}
              radius={4}
              top
              style={{ cursor: 'pointer' }}
              x={xPosition}
              y={yPosition}
              width={barWidth}
              height={barHeight}
              fill={BeanstalkPalette.theme.winter.primary}
            />
            <BarRounded
              key={`hover-bar-${x}`}
              radius={4}
              top
              style={{ cursor: 'pointer' }}
              x={xPosition - additionalHoverBarWidth / 2}
              y={0}
              width={barWidth + additionalHoverBarWidth}
              height={yMax}
              fill={fillColor}
              onPointerEnter={() => onBarHoverEnter(datum)}
              onPointerLeave={() => onBarHoverLeave(datum)}
            />
          </>
        );
      };

      return BarComponent;
    },
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yMax, xScale, yScale]
  );

  const XAxis = useMemo(() => {
    const XAxisComponent: React.FC = () => (
      <Axis
        key="x-axis"
        top={yMax}
        orientation={Orientation.bottom}
        scale={xScale}
        stroke={axisColor}
        tickStroke={axisColor}
        tickFormat={xTickFormat}
        tickLabelProps={xTickLabelProps}
      />
    );

    return XAxisComponent;
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartHeight, xScale]);

  const YAxis = useMemo(() => {
    const YAxisComponent: React.FC = () => (
      <Axis
        key="y-axis"
        left={chartWidth - chartPadding.right}
        orientation={Orientation.right}
        scale={yScale}
        stroke={axisColor}
        tickFormat={yTickFormat}
        tickStroke={axisColor}
        tickLabelProps={yTickLabelProps}
        numTicks={6}
        strokeWidth={0}
      />
    );

    return YAxisComponent;
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartWidth, yScale]);

  return { XAxis, YAxis, Bar };
};

const BarChart: React.FC<{
  seriesData: Array<object>;
  width: number;
  height: number;
  getX: (datum: any) => string;
  getY: (datum: any) => number;
  xTickFormat: (datum: any) => string;
  yTickFormat: (datum: any) => string;
  onBarHoverEnter?: (datum: object) => void;
  onBarHoverLeave?: (datum: object) => void;
}> = ({
  seriesData,
  width,
  height,
  getX,
  getY,
  xTickFormat,
  yTickFormat,
  onBarHoverEnter = () => {},
  onBarHoverLeave = () => {},
}) => {
  const [activeBarIndex, setActiveBarIndex] = useState<number | undefined>(
    undefined
  );
  const { XAxis, YAxis, Bar } = useBarChart({
    seriesData,
    chartWidth: width,
    chartHeight: height,
    getX,
    getY,
    xTickFormat,
    yTickFormat,
  });

  return (
    <svg width={width} height={height}>
      <YAxis />
      <XAxis />
      <Group width={width - yAxisWidth}>
        {seriesData.map((d, index) => (
          <Bar
            key={index}
            datum={d}
            isActive={activeBarIndex === index}
            onBarHoverEnter={(datum) => {
              setActiveBarIndex(index);
              onBarHoverEnter(datum);
            }}
            onBarHoverLeave={(datum) => {
              setActiveBarIndex(undefined);
              onBarHoverLeave(datum);
            }}
          />
        ))}
      </Group>
    </svg>
  );
};

export default withTooltip(BarChart);
