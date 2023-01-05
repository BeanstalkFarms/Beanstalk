import React from 'react';
import { tickFormatLocale } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { BEAN } from '~/constants/tokens';
import { SeasonalDeltaBDocument, SeasonalDeltaBQuery } from '~/generated/graphql';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';
import { toTokenUnitsBN } from '~/util';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalDeltaBQuery>) => toTokenUnitsBN(season.deltaB, BEAN[1].decimals).toNumber();
const formatValue = (value: number) => `${value.toLocaleString('en-us', { maximumFractionDigits: 2 })}`;
const statProps = {
  title: 'Delta B',
  titleTooltip: 'The delta B at the end of every Season.',
  gap: 0.25,
};
const lineChartProps : Partial<LineChartProps> = {
  yTickFormat: tickFormatLocale
};

const DeltaB: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => (
  <SeasonPlot<SeasonalDeltaBQuery>
    document={SeasonalDeltaBDocument}
    height={height}
    getValue={getValue}
    formatValue={formatValue}
    StatProps={statProps}
    LineChartProps={lineChartProps}
  />
);

export default DeltaB;
