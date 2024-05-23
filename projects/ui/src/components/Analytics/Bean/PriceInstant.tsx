import React from 'react';
import BigNumber from 'bignumber.js';
import { tickFormatBeanPrice } from '~/components/Analytics/formatters';
import { LineChartProps } from '~/components/Common/Charts/LineChart';
import SeasonPlot, {
  SeasonPlotBaseProps,
} from '~/components/Common/Charts/SeasonPlot';
import {
  SeasonalInstantPriceDocument,
  SeasonalInstantPriceQuery,
} from '~/generated/graphql';
import usePrice from '~/hooks/beanstalk/usePrice';
import useSeason from '~/hooks/beanstalk/useSeason';
import { SnapshotData } from '~/hooks/beanstalk/useSeasonsQuery';

import { FC } from '~/types';

const getValue = (season: SnapshotData<SeasonalInstantPriceQuery>) =>
  parseFloat(season.price);
const formatValue = (value: number) => `$${value.toFixed(4)}`;
const statProps = {
  title: 'Bean Price',
  titleTooltip: 'The USD price of 1 Bean at the beginning of every Season.',
  gap: 0.25,
};

const queryConfig = {
  variables: { season_gte: 1 },
  context: { subgraph: 'bean' },
};

const lineChartProps: Partial<LineChartProps> = {
  pegLine: true,
  yTickFormat: tickFormatBeanPrice,
};

const Price: FC<{ height?: SeasonPlotBaseProps['height'] }> = ({ height }) => {
  const price = usePrice();
  const season = useSeason();
  return (
    <SeasonPlot<SeasonalInstantPriceQuery>
      document={SeasonalInstantPriceDocument}
      height={height}
      defaultValue={
        price?.gt(0) ? price.dp(4, BigNumber.ROUND_FLOOR).toNumber() : 0
      } // FIXME: partial dup of `displayBeanPrice`
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      queryConfig={queryConfig}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      dateKey="timestamp"
    />
  );
};

export default Price;
