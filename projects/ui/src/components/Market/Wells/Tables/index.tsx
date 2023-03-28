 import React from 'react';
import { Tab, Tabs, useMediaQuery } from '@mui/material';
import { DataGridProps } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';
import BigNumber from 'bignumber.js';
import useTabs from '~/hooks/display/useTabs';
import { PodListing } from '~/state/farmer/market';
import COLUMNS from '~/components/Common/Table/cells';
import useMarketData from '~/hooks/beanstalk/useMarketData';
import TabTable from '~/components/Common/Table/TabTable';
import { Module, ModuleContent } from '~/components/Common/Module';
import { BEAN, PODS } from '~/constants/tokens';
import { FC } from '~/types';

// TODO: dummy type
export type WellActivityData = {
  hash: string;
  label: string;
  totalValue: BigNumber;
  tokenAmount0: BigNumber;
  tokenAmount1: BigNumber;
  account: string;
  time: string;
}

const SLUGS = ['all', 'swaps', 'adds', 'removes'];

const WellActivity: FC<{}> = () => {
  const theme = useTheme();
  const [tab, handleChangeTab] = useTabs(SLUGS, 'bean');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const data = useMarketData();

  /// Data Grid setup
  const columns: DataGridProps['columns'] = !isMobile
    ? [
      // COLUMNS.listingId(1.3),
      // // index
      // COLUMNS.plotIndex(data.harvestableIndex, 1),
      // // pricePerPod
      // COLUMNS.pricePerPod(1),
      // // amount
      // maxHarvestableIndex
      COLUMNS.label(
        2.5,
        <Tabs value={tab} onChange={handleChangeTab}>
          <Tab label="All" />
          <Tab label="Swaps" />
          <Tab label="Adds" />
          <Tab label="Removes" />
        </Tabs>
      ),
      COLUMNS.totalValue(1),
      COLUMNS.tokenAmount('tokenAmount0', BEAN[1], 1),
      COLUMNS.tokenAmount('tokenAmount1', PODS, 1),
      COLUMNS.account(1),
      COLUMNS.time(1),
    ]
    : [];

  const N = 30;
  const mockWellActivityData = new Array(N).fill(null).map((_, i) => ({
    label: 'Swap ETH for BEAN',
    totalValue: new BigNumber(3000 * Math.random()),
    tokenAmount0: new BigNumber(Math.random()),
    tokenAmount1: new BigNumber(3000 * Math.random()),
    account: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    time: '5 minutes ago',
  }));

  return (
    <Module sx={{ py: 2, px: 1 }}>
      {/* <ModuleTabs value={tab} onChange={handleChangeTab}> */}
      {/*  <Tab label="All" /> */}
      {/*  <Tab label="Swaps" /> */}
      {/*  <Tab label="Adds" /> */}
      {/*  <Tab label="Removes" /> */}
      {/* </ModuleTabs> */}
      <ModuleContent>
        <TabTable
          columns={columns}
          rows={mockWellActivityData}
          loading={data.loading}
          maxRows={8}
          getRowId={(row : PodListing) => `${row.account}-${row.id}`}
        />
      </ModuleContent>
    </Module>
  );
};

export default WellActivity;
