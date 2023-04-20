import React, { useMemo, useState } from 'react';
import BaseTable from './BaseTable';
import { FarmerMarketOrder } from '~/hooks/farmer/market/useFarmerMarket2';
import MarketItemDetailsDialog from '../Actions/MarketItemDetailsDialog';
import { MarketColumns } from '~/components/Market/PodsV2/Tables/columns/market-columns';

const columns = [
  MarketColumns.Shared.createdAt(1, 'left', 'DATE', 'creationHash'),
  MarketColumns.HistoryItem.labelType(0.6),
  MarketColumns.HistoryItem.amountPods(1, 'left'),
  MarketColumns.Shared.placeInLine(undefined, 1, 'left'),
  MarketColumns.Shared.pricePerPod(0.8),
  MarketColumns.HistoryItem.amountBeans(1.3),
  MarketColumns.HistoryItem.fillPct(0.6),
  MarketColumns.Shared.expiry(0.5),
  MarketColumns.HistoryItem.status(0.6, 'right'),
];
/**
 * Displays a table of a Farmer's outstanding Listings and Orders.
 */
const FarmerOrders: React.FC<{
  data: FarmerMarketOrder[] | undefined;
  initializing: boolean;
}> = ({ data, initializing }) => {
  const [open, setOpen] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [activeItem, setActiveItem] = useState<FarmerMarketOrder | undefined>(undefined);

  const rows = useMemo(() => {
    if (!data || !data?.length) return [];
    return data;
  }, [data]);

  return (
    <>
      <BaseTable
        isUserTable
        rows={rows}
        columns={columns}
        loading={initializing}
        title="Orders and Listings"
        getRowId={(row) => row.id}
        onRowClick={({ row }) => {
          const item = rows.find((r) => r.id === row.id);
          item && setActiveItem(item);
          setOpen(true);
        }}
        sortModel={[]}
      />
      <MarketItemDetailsDialog
        item={activeItem}
        open={open}
        open2={showModeDialog}
        setOpen2={setShowModeDialog}
        setOpen={setOpen}
      />
    </>
  );
};

export default FarmerOrders;
