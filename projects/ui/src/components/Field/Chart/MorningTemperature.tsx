import React, { useMemo, useState } from 'react';
import BigNumber from 'bignumber.js';
import debounce from 'lodash/debounce';

import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { BarRounded } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Axis, Orientation } from '@visx/axis';

import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { chartHelpers } from '~/components/Common/Charts/ChartPropProvider';
import { tickFormatPercentage } from '~/components/Analytics/formatters';

import './chart.css';
import useSeason from '~/hooks/beanstalk/useSeason';
import { Sun } from '~/state/beanstalk/sun';
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
import { AppState } from '~/state';

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
        range: [yMax, 0],
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
        numTicks={6}
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
            const _barHeight = yMax - temperatureScale(getTemperature(d)) ?? 0;

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
                cursor="pointer"
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
  onHover: (block: MorningBlockTemperature | undefined) => void;
}> = ({ seriesData, interval, onHover }) => {
  if (!seriesData) return null;

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

const MorningTemperature: React.FC<{
  height?: string;
}> = ({ height = '200px' }) => {
  const morning = useSelector<AppState, Sun['morning']>(
    (state) => state._beanstalk.sun.morning
  );

  const [{ current, max }, { generate }] = useTemperature();
  const temperatureMap = useMemo(() => generate(), [generate]);

  const blockNumber = morning.blockNumber;
  const interval = morning.index.plus(1);
  const season = useSeason();

  const [temperatures, loading] = useMemo(() => {
    const _temperatures = Object.values(temperatureMap);
    const _loading = !_temperatures || _temperatures.length === 0;

    return [_temperatures, _loading] as const;
  }, [temperatureMap]);

  const [hovered, setHovered] = useState<MorningBlockTemperature | undefined>(
    undefined
  );
  // We debounce b/c part of the Stat is rendered conditionally
  // base on the hover state and causes flickering
  const _setHovered = useMemo(
    () => debounce(setHovered, 40, { trailing: true }),
    []
  );

  const temperatureDisplay = hovered?.temperature || current;

  const temperatureIncrease = useMemo(() => {
    const nextInterval = interval.plus(1);
    if (getIsMorningInterval(nextInterval)) {
      const nextTemp =
        temperatureMap[blockNumber.plus(1).toString()]?.temperature;
      return nextTemp?.minus(temperatureDisplay || ZERO_BN) || ZERO_BN;
    }
    if (nextInterval.eq(26)) {
      return max?.minus(temperatureDisplay || ZERO_BN) || ZERO_BN;
    }

    return ZERO_BN;
  }, [blockNumber, interval, max, temperatureDisplay, temperatureMap]);

  return (
    <>
      <ChartInfoOverlay
        gap={0}
        title="Temperature"
        titleTooltip={
          <Box>
            The interest rate for Sowing Beans. Beanstalk logarithmically
            increases the Temperature for the first 25 blocks of each Season up
            to the Max Temperature.
          </Box>
        }
        amount={
          <Row alignItems="center" gap={0.5}>
            <Typography variant="h2">
              {displayFullBN(temperatureDisplay || ZERO_BN, 0)}%
            </Typography>
            {!hovered && (
              <Typography color="text.secondary">
                (
                <Typography color="primary" component="span">
                  +{displayFullBN(temperatureIncrease, 0)}%
                </Typography>
                &nsbp; in <FieldBlockCountdown />)
              </Typography>
            )}
          </Row>
        }
        subtitle={<Typography>Season {season.toString()}</Typography>}
        isLoading={!temperatureDisplay}
      />
      <Box width="100%" sx={{ height, position: 'relative' }}>
        {loading ? (
          <Centered minHeight={height}>
            <CircularProgress variant="indeterminate" />
          </Centered>
        ) : (
          <ChartWrapper
            seriesData={temperatures}
            interval={interval}
            onHover={(_block) => _setHovered(_block)}
          />
        )}
      </Box>
    </>
  );
};

export default MorningTemperature;
