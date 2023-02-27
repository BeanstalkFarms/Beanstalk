import React, { useMemo } from 'react';
import { Tab, Tabs, useMediaQuery } from '@mui/material';
import { DataGridProps, GridColumns } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';
import useTabs from '~/hooks/display/useTabs';
import COLUMNS from '~/components/Common/Table/cells';
import useMarketData from '~/hooks/beanstalk/useMarketData';
import TabTable from '~/components/Common/Table/TabTable';
import { Module, ModuleContent, ModuleTabs } from '~/components/Common/Module';
import { FC } from '~/types';
import { WellProps } from '../WellReserves';
import useWell from '~/hooks/wells/useWell';
import WELLS_COLUMNS from './WellsColumns';
import BigNumber from 'bignumber.js';

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

// Activity that appears on the bottom of the Well detail page
// I.e. swaps/ adds/ removes
const WellActivity: FC<WellProps> = ({ wellId }) => {
  const theme = useTheme();
  const [tab, handleChangeTab] = useTabs();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // data.loading
  const data = useMarketData();

  const { wellSwaps, wellDeposits, wellWithdraws } = useWell(wellId);

  // const columns: DataGridProps['columns'] = !isMobile
  const swapColumns: DataGridProps['columns'] = useMemo(() => {
    return [
      WELLS_COLUMNS.DESCRIPTION,
      WELLS_COLUMNS.AMOUNT_IN,
      WELLS_COLUMNS.AMOUNT_OUT,
      COLUMNS.account(1),
      WELLS_COLUMNS.TIME,
    ] as GridColumns;
  }, []);

  const liquidityColumns: DataGridProps['columns'] = useMemo(() => {
    return [
      WELLS_COLUMNS.DESCRIPTION,
      WELLS_COLUMNS.AMOUNT_USD,
      COLUMNS.account(1),
      WELLS_COLUMNS.TIME,
    ] as GridColumns;
  }, []);

  // const rows = useMemo(() => (!data || !data.length ? [] : data), [data]);

  return (
    <Module sx={{ py: 2, px: 1 }}>
      <ModuleTabs value={tab} onChange={handleChangeTab}>
        <Tab label="Swaps" />
        <Tab label="Adds" />
        <Tab label="Removes" />
      </ModuleTabs>
      <ModuleContent>
        {tab === 0 && (
          <TabTable
            columns={swapColumns}
            rows={wellSwaps}
            loading={data.loading}
            maxRows={10}
            getRowId={(row) => row.hash}
          />
        )}
        {tab === 1 && (
          <TabTable
            columns={liquidityColumns}
            rows={wellDeposits}
            loading={data.loading}
            maxRows={10}
            getRowId={(row) => row.hash}
          />
        )}
        {tab === 2 && (
          <TabTable
            columns={liquidityColumns}
            rows={wellWithdraws}
            loading={data.loading}
            maxRows={10}
            getRowId={(row) => row.hash}
          />
        )}
      </ModuleContent>
    </Module>
  );
};

export default WellActivity;
