import React, { useMemo, useState } from 'react';
import BigNumber from 'bignumber.js';
import debounce from 'lodash/debounce';

import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { BarRounded } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Axis, Orientation } from '@visx/axis';

import { Box, CircularProgress, Typography } from '@mui/material';
import { chartHelpers } from '~/components/Common/Charts/ChartPropProvider';
import { tickFormatPercentage } from '~/components/Analytics/formatters';

import './chart.css';
import Row from '~/components/Common/Row';
import { displayFullBN } from '~/util';
import Centered from '~/components/Common/ZeroState/Centered';
import ChartInfoOverlay from '~/components/Common/Charts/ChartInfoOverlay';
import { ZERO_BN } from '~/constants';
import { getIsMorningInterval } from '~/state/beanstalk/sun/morning';
import FieldBlockCountdown from '~/components/Field/FieldBlockCountdown';
import useTemperature, {
  MorningBlockTemperature,
} from '~/hooks/beanstalk/useTemperature';
import { useAppSelector } from '~/state';

const {
  common: {
    axisColor,
    axisHeight,
    strokeBuffer,
    yAxisWidth,
    xTickLabelProps,
    yTickLabelProps,
    chartPadding,
    margin,
  },
} = chartHelpers;

const NON_MORNING_BN = new BigNumber(26);

const getInterval = (d: MorningBlockTemperature) => d.interval.toNumber();

const getTemperature = (d: MorningBlockTemperature) => d.temperature.toNumber();

const getClassName = (barState: { isPast: boolean; isCurrent: boolean }) => {
  if (barState.isCurrent) return 'bar-current';
  if (barState.isPast) return 'bar-past';
  return 'bar-future';
};

const getIntervalStatus = (
  data: MorningBlockTemperature,
  currentInterval: BigNumber
) => ({
  isCurrent: currentInterval.eq(getInterval(data)),
  isPast: currentInterval.gt(getInterval(data)),
});

type Props = {
  height: number;
  width: number;
  seriesData: MorningBlockTemperature[];
  interval: BigNumber;
  onHover: (block: MorningBlockTemperature | undefined) => void;
};

const useTemperatureChart = ({
  width,
  height,
  seriesData,
}: Omit<Props, 'onHover' | 'interval'>) => {
  const verticalMargin = margin.top + margin.bottom;
  const xMax = width;
  const yMax = height - verticalMargin;

  const lastScaledTemperature = seriesData[seriesData.length - 1].temperature;

  const intervalScale = useMemo(() => {
    const scale = scaleBand<number>({
      range: [0, xMax - yAxisWidth],
      round: true,
      domain: seriesData.map(getInterval),
      padding: 0.1,
    });
    return scale;
  }, [seriesData, xMax]);

  const temperatureScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, margin.bottom],
        round: true,
        domain: [0, lastScaledTemperature.toNumber() * 1.05],
      }),
    [lastScaledTemperature, yMax]
  );

  const dataRegion = {
    yTop: margin.top, // chart edge to data region first pixel
    yBottom:
      height - // chart edge to data region first pixel
      axisHeight - // chart edge to data region first pixel
      margin.bottom - // chart edge to data region first pixel
      strokeBuffer,
  };

  const numTicks = {
    x: width > 600 ? 25 : 13,
  };

  return {
    intervalScale,
    temperatureScale,
    dataRegion,
    numTicks,
    yMax,
  };
};

const Chart: React.FC<Props> = ({
  seriesData,
  width,
  height,
  interval: currentInterval,
  onHover,
}) => {
  const { intervalScale, temperatureScale, yMax, dataRegion, numTicks } =
    useTemperatureChart({
      width,
      height,
      seriesData,
    });

  const XAxis = useMemo(() => {
    const XAxisComponent: React.FC = () => (
      <Axis
        key="x-axis"
        hideAxisLine
        top={yMax - margin.bottom / 2}
        orientation={Orientation.bottom}
        scale={intervalScale}
        stroke={axisColor}
        tickStroke={axisColor}
        tickLabelProps={xTickLabelProps}
        hideTicks
        numTicks={numTicks.x}
      />
    );

    return XAxisComponent;
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, intervalScale, numTicks.x]);

  const YAxis = useMemo(() => {
    const YAxisComponent: React.FC = () => (
      <Axis
        key="y-axis"
        left={width - chartPadding.right}
        orientation={Orientation.right}
        scale={temperatureScale}
        stroke={axisColor}
        tickFormat={tickFormatPercentage}
        tickStroke={axisColor}
        tickLabelProps={yTickLabelProps}
        numTicks={4}
        strokeWidth={0}
      />
    );

    return YAxisComponent;
    // We are disabling this lint error because we only want this effect to re-run
    // for the following values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, temperatureScale]);

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group
          width={width - yAxisWidth}
          height={dataRegion.yBottom - dataRegion.yTop}
        >
          {seriesData.map((d, i) => {
            const interval = getInterval(d);
            const barWidth = intervalScale.bandwidth();
            const _barHeight = yMax - temperatureScale(getTemperature(d));

            /// Minimum value of 5px to prevent the bar from being too small
            const barHeight = i === 0 ? Math.max(10, _barHeight) : _barHeight;

            const barX = intervalScale(interval) ?? 0;
            const barY = yMax - barHeight;

            const barState = getIntervalStatus(d, currentInterval);
            const className = getClassName(barState);

            return (
              <BarRounded
                key={`bar-${interval}`}
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                className={className}
                radius={0}
                top
                onMouseEnter={() => onHover(d)}
                onTouchStart={() => onHover(d)}
                onMouseLeave={() => onHover(undefined)}
                onTouchEnd={() => onHover(undefined)}
              />
            );
          })}
        </Group>
        <XAxis />
        <YAxis />
      </svg>
    </div>
  );
};

const ChartWrapper: React.FC<{
  seriesData: MorningBlockTemperature[] | undefined;
  interval: BigNumber;
  onHover: (data: MorningBlockTemperature | undefined) => void;
}> = ({ seriesData, interval, onHover }) => {
  if (!seriesData?.length) return null;

  return (
    <ParentSize debounceTime={50}>
      {({ width: visWidth, height: visHeight }) => (
        <Chart
          width={visWidth}
          height={visHeight}
          interval={interval}
          seriesData={seriesData}
          onHover={onHover}
        />
      )}
    </ParentSize>
  );
};

const SECONDS_PER_INTERVAL = 12;

const formatTimestamp = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

const MorningTemperature: React.FC<{
  show: boolean;
  height?: string;
}> = ({ show = false, height = '200px' }) => {
  const sunSeason = useAppSelector((s) => s._beanstalk.sun.season);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);

  const [{ current, max }, { loading, generate, calculate }] = useTemperature();

  /// Local State
  const [hovered, setHovered] = useState<MorningBlockTemperature | undefined>(
    undefined
  );

  const temperatureSeriesData: MorningBlockTemperature[] = useMemo(
    () => Object.values(generate()),
    [generate]
  );

  /// Derived
  const season = sunSeason.current;
  const temperatureDisplay = hovered?.temperature || current;

  const secondsElapsedSinceSunrise = morning.isMorning
    ? hovered
      ? hovered.interval.times(SECONDS_PER_INTERVAL).toNumber()
      : morning.index.times(SECONDS_PER_INTERVAL).toNumber()
    : 0;

  const displayTimestamp = formatTimestamp(
    sunSeason.timestamp
      .plus({ seconds: secondsElapsedSinceSunrise })
      .toSeconds()
  );

  const interval = useMemo(
    () => (morning.isMorning ? morning.index.plus(1) : NON_MORNING_BN),
    [morning.isMorning, morning.index]
  );

  const temperatureIncrease = useMemo(() => {
    const nextInterval = interval.plus(1);
    if (getIsMorningInterval(nextInterval)) {
      const nextTemp = calculate(nextInterval);
      return nextTemp?.minus(temperatureDisplay || ZERO_BN) || ZERO_BN;
    }
    if (nextInterval.eq(26)) {
      return max?.minus(temperatureDisplay || ZERO_BN) || ZERO_BN;
    }

    return ZERO_BN;
  }, [interval, max, temperatureDisplay, calculate]);

  // We debounce b/c part of the Stat is rendered conditionally
  // based on the hover state and causes flickering
  const _setHovered = useMemo(
    () => debounce(setHovered, 20, { trailing: true }),
    []
  );

  return (
    <>
      <ChartInfoOverlay
        gap={0.5}
        title="Temperature"
        titleTooltip={
          <Box>
            The interest rate for Sowing Beans. Beanstalk logarithmically
            increases the Temperature for the first 5 minutes of each Season up
            to the Max Temperature.
          </Box>
        }
        amount={
          <Row alignItems="center" gap={0.5}>
            <Typography variant="h2">
              {`${(temperatureDisplay || ZERO_BN).toFixed(0)}%`}
            </Typography>
            {!hovered && !show && (
              <Typography color="text.secondary">
                (
                <Typography color="primary" component="span">
                  +{displayFullBN(temperatureIncrease, 0)}%
                </Typography>{' '}
                in <FieldBlockCountdown />)
              </Typography>
            )}
          </Row>
        }
        subtitle={
          <Typography variant="bodySmall">
            Season {season.toString()}
          </Typography>
        }
        secondSubtitle={displayTimestamp}
        isLoading={!temperatureDisplay}
      />
      <Box width="100%" sx={{ height, position: 'relative' }}>
        {loading ? (
          <Centered minHeight={height}>
            <CircularProgress variant="indeterminate" />
          </Centered>
        ) : (
          <ChartWrapper
            seriesData={temperatureSeriesData}
            interval={interval}
            onHover={(data) => _setHovered(data)}
          />
        )}
      </Box>
    </>
  );
};

export default MorningTemperature;
