import React from 'react';
import { useSelector } from 'react-redux';
import { tickFormatPercentage } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalTemperatureDocument, SeasonalTemperatureQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { AppState } from '~/state';

import { FC } from '~/types';

const getValue = (snapshot: SnapshotData<SeasonalTemperatureQuery>) => snapshot.temperature;
const formatValue = (value: number) => `${value.toFixed(0)}%`;
const statProps = {
  title: 'Temperature',
  titleTooltip: 'The interest rate for Sowing Beans each Season.',
  gap: 0.5,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatPercentage
};

const Temperature: FC<{height?: SeasonPlotBaseProps['height']}> = ({ height }) => {
  const temperature = useSelector<AppState, AppState['_beanstalk']['field']['weather']['yield']>((state) => state._beanstalk.field.weather.yield);
  const season  = useSeason();
  return (
    <SeasonPlot<SeasonalTemperatureQuery>
      height={height}
      document={SeasonalTemperatureDocument}
      defaultValue={temperature?.gt(0) ? temperature.toNumber() : 0}
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
    />
  );
};

export default Temperature;
