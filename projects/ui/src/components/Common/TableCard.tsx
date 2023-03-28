import React, { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import {
  Box,
  Card,
  CircularProgress,
  Typography,
} from '@mui/material';
import { DataGrid, GridColumns, GridSortItem } from '@mui/x-data-grid';
import { tableStyle } from '~/components/Common/Table/styles';
import { displayBN } from '~/util';
import { ZERO_BN } from '~/constants';
import { Token } from '../../classes';
import AuthEmptyState from './ZeroState/AuthEmptyState';
import ArrowPagination from './ArrowPagination';
import Fiat from './Fiat';
import Row from '~/components/Common/Row';

/**
 * Displays a <DataGrid /> with data about Crates. Attaches
 * a header with title, aggregate amount, and aggregate value.
 * Used to display deposits/withdrawals within the Silo.
 */
import { FC } from '~/types';

const MAX_ROWS = 5;

const TableCard: FC<{
  /** Card title */
  title: string;
  /** Column setup */
  columns: GridColumns;
  /** Data */
  rows: any[];
  /** Aggregate amount */
  amount?: BigNumber;
  /** Aggregate USD value */
  value?: BigNumber;
  /** Loading / connection state */
  state: 'disconnected' | 'loading' | 'ready';
  /** Table sorting */
  sort?: GridSortItem;
  /** Token */
  token?: Token;
  /** true if should hide title component */
  onlyTable?: boolean;
  /** additional table styles */
  tableCss?: any;
  /** disable border */
}> = ({
  title,
  columns,
  rows,
  amount,
  value,
  state,
  sort = { field: 'season', sort: 'desc' },
  token,
  onlyTable = false,
  tableCss,
}) => {
  const tableHeight = useMemo(() => {
    if (!rows || rows.length === 0) return '250px';
    return 60.5 + 6 + 39 - 5 + Math.min(rows.length, MAX_ROWS) * 36;
  }, [rows]);
  return (
    <Card sx={{ border: onlyTable ? '0px solid' : undefined }}>
      {!onlyTable && (
        <Row p={2} justifyContent="space-between" sx={{ borderBottom: '0.5px solid', borderColor: 'divider' }}>
          <Typography variant="h4">{title}</Typography>
          {state === 'ready' ? (
            <Row gap={0.3}>
              {token && <img src={token.logo} alt="" height="17px" />}
              <Typography variant="h4" component="span">
                {displayBN(amount || ZERO_BN)}
                {value && (
                  <Typography
                    display={{ xs: 'none', sm: 'inline' }}
                    color="text.tertiary"
                  >
                    {' '}
                    (<Fiat value={value} amount={value} />)
                  </Typography>
                )}
              </Typography>
            </Row>
          ) : state === 'loading' ? (
            <CircularProgress
              color="primary"
              variant="indeterminate"
              size={18}
              thickness={5}
            />
          ) : null}
        </Row>
      )}
      {/* <Divider sx={{ borderColor: 'divider' }} /> */}
      <Box
        sx={{
          pt: 0.5,
          px: 1,
          height: tableHeight,
          width: '100%',
          ...tableStyle,
          ...tableCss,
        }}
      >
        <DataGrid
          columns={columns}
          rows={rows}
          pageSize={MAX_ROWS}
          disableSelectionOnClick
          disableColumnMenu
          density="compact"
          components={{
            NoRowsOverlay() {
              return (
                <AuthEmptyState
                  message={`Your ${title} will appear here.`}
                  hideWalletButton
                />
              );
            },
            Pagination: ArrowPagination,
          }}
          initialState={{
            sorting: {
              sortModel: [sort],
            },
          }}
          sx={{
            '& .MuiDataGrid-footerContainer': {
              justifyContent: 'center',
            },
          }}
        />
      </Box>
    </Card>
  );
};

export default TableCard;
