import React from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SeasonPlot, { SeasonPlotBaseProps } from '~/components/Common/Charts/SeasonPlot';
import { SeasonalSupplyQuery, SeasonalSupplyDocument } from '~/generated/graphql';
import { BEAN } from '~/constants/tokens';
import { toTokenUnitsBN } from '~/util';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import { tickFormatTruncated } from '~/components/Analytics/formatters'; 

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalSupplyQuery>) => toTokenUnitsBN(season.beans, BEAN[1].decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const useStatProps = () => {
  const theme = useTheme();
  const isTiny = useMediaQuery(theme.breakpoints.down('md'));
  return {
    title: isTiny ? 'Supply' : 'Bean Supply',
    titleTooltip: 'The total Bean supply at the end of every Season.',
    gap: 0.25,
  };
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatTruncated
};

const Supply: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const statProps = useStatProps();
  return (
    <SeasonPlot<SeasonalSupplyQuery>
      height={height}
      document={SeasonalSupplyDocument}
      getValue={getValue}
      formatValue={formatValue}
      LineChartProps={lineChartProps}
      StatProps={statProps}
    />
  );
};

export default Supply;
