import BigNumber from 'bignumber.js';
import React from 'react';
import { tickFormatBeanPrice } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import { Season, SeasonalPriceDocument } from '~/generated/graphql';
import usePrice from '~/hooks/beanstalk/usePrice';
import useSeason from '~/hooks/beanstalk/useSeason';

import { FC } from '~/types';

const getValue = (season: Season) => parseFloat(season.price);
const formatValue = (value: number) => `$${value.toFixed(4)}`;
const statProps = {
  title: 'Bean Price',
  titleTooltip: 'The price at the end of every Season.',
  gap: 0.25,
};
const lineChartProps : Partial<LineChartProps> = {
  isTWAP: true,
  yTickFormat: tickFormatBeanPrice
};

const Price: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({
  height,
}) => {
  const price = usePrice();
  const season = useSeason();
  return (
    <SeasonPlot
      document={SeasonalPriceDocument}
      height={height}
      defaultValue={price?.gt(0) ? price.dp(4, BigNumber.ROUND_FLOOR).toNumber() : 0} // FIXME: partial dup of `displayBeanPrice`
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
    />
  );
};

export default Price;
