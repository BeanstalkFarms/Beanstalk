import React, { useMemo } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { DataGridProps } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import useMarketData from '~/hooks/beanstalk/useMarketData';
import { MarketColumns } from './columns/market-columns';
import BaseTable from './BaseTable';
import { PodListing } from '~/state/farmer/market';

const AllActiveListings: React.FC<{
  data: ReturnType<typeof useMarketData>;
}> = ({ data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const columns: DataGridProps['columns'] = useMemo(() => {
    const c = [
      MarketColumns.Shared.createdAt(1, 'left', 'CREATED AT', 'creationHash'),
      MarketColumns.PodListing.listingId(1, 'left'),
      MarketColumns.Shared.placeInLine('listing', 1, 'left'),
      MarketColumns.Shared.pricePerPod(1, 'left'),
      MarketColumns.PodListing.remainingAmount(0.7, 'left'),
    ];

    // FIXME: MUI must provide a performant way to hide columns depending on screen size
    if (!isMobile) {
      c.push(MarketColumns.Shared.expiry(1, 'right'));
    }

    return c;
  }, [isMobile]);

  return (
    <BaseTable
      columns={columns}
      rows={data.listings || []}
      loading={data.loading}
      getRowId={(row: PodListing) => `${row.account}-${row.id}`}
      onRowClick={({ row }) => {
        navigate(`/market/buy/${row.id.toString()}`);
      }}
    />
  );
};

export default AllActiveListings;
