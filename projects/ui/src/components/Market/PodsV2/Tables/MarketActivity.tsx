import React, { useMemo } from 'react';
import BaseTable from './BaseTable';
import { MarketEvent } from '~/hooks/beanstalk/useMarketActivityData';
import { MarketColumns } from '~/components/Market/PodsV2/Tables/columns/market-columns';

const columns = [
  MarketColumns.Shared.createdAt(1),
  MarketColumns.HistoryItem.labelType(1),
  MarketColumns.ActivityItem.labelAction(1),
  MarketColumns.Shared.placeInLine(undefined, 1),
  MarketColumns.Shared.pricePerPod(1),
  MarketColumns.HistoryItem.amountPods(1),
  MarketColumns.HistoryItem.amountBeans(0.75, 'left'),
];

/**
 * Displays a table of all activity on the Market, including:
 * 
 * Order, Listings
 * Create, Fill, Cancel
 */
const MarketActivity: React.FC<{
  data: MarketEvent[] | undefined;
  initializing: boolean;
  fetchMoreData: () => Promise<void>;
}> = ({ data, initializing, fetchMoreData }) => {
  const rows = useMemo(() => (!data || !data.length ? [] : data), [data]);

  return (
    <BaseTable
      rows={rows}
      columns={columns}
      loading={initializing}
      fetchMore={fetchMoreData}
      getRowId={(row: MarketEvent) => row.eventId}
    />
  );
};

export default MarketActivity;
