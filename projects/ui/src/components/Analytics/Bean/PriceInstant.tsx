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
import { subgraphQueryConfigs, subgraphQueryKeys } from '~/util/Graph';

const getValue = (season: SnapshotData<SeasonalInstantPriceQuery>) =>
  parseFloat(season.price);
const formatValue = (value: number) => `$${value.toFixed(4)}`;
const statProps = {
  title: 'Bean Price',
  titleTooltip: 'The USD price of 1 Bean at the beginning of every Season.',
  gap: 0.25,
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
      height={height}
      document={SeasonalInstantPriceDocument}
      queryConfig={subgraphQueryConfigs.priceInstantBEAN.queryOptions}
      cacheDocument={subgraphQueryConfigs.cachedPriceInstantBEAN.document}
      cacheWhere={subgraphQueryConfigs.cachedPriceInstantBEAN.where}
      defaultValue={
        price?.gt(0) ? price.dp(4, BigNumber.ROUND_FLOOR).toNumber() : 0
      } // FIXME: partial dup of `displayBeanPrice`
      defaultSeason={season?.gt(0) ? season.toNumber() : 0}
      getValue={getValue}
      formatValue={formatValue}
      StatProps={statProps}
      LineChartProps={lineChartProps}
      dateKey="timestamp"
      name={subgraphQueryKeys.priceInstantBEAN}
    />
  );
};

export default Price;
