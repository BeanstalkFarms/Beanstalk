import React, { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { Box, Card, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  DataGrid,
  GridColDef,
  GridColumns,
  GridRowId,
  GridRowModel,
  GridSortItem,
} from '@mui/x-data-grid';
import { tableStyle } from '~/components/Common/Table/styles';
import { displayBN } from '~/util';
import { ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { Token } from '../../classes';
import AuthEmptyState from './ZeroState/AuthEmptyState';
import ArrowPagination from './ArrowPagination';
import Fiat from './Fiat';

export type TableCardProps = {
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
  maxRows?: number;
  hideFooter?: true | undefined;
  footNote?: string | undefined;
};

interface GridRowParams<R extends GridRowModel = GridRowModel> {
  id: GridRowId;
  /**
   * The row model of the row that the current cell belongs to.
   */
  row: R;
  /**
   * All grid columns.
   */
  columns: GridColDef[];
}

const StyledDataGrid = styled(DataGrid)(() => ({
  '& .germinating-row': {
    backgroundColor: '#b4e16236',
    '&:hover': {
      backgroundColor: '#b4e16236',
    },
  },
}));

/**
 * Displays a <DataGrid /> with data about Crates. Attaches
 * a header with title, aggregate amount, and aggregate value.
 * Used to display deposits/withdrawals within the Silo.
 */
const TableCard: FC<TableCardProps> = ({
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
  maxRows = 5,
  hideFooter = false,
  footNote,
}) => {
  const tableHeight = useMemo(() => {
    if (!rows || rows.length === 0) return '250px';
    return 60.5 + (hideFooter ? 0 : 36) + Math.min(rows.length, maxRows) * 36;
  }, [hideFooter, maxRows, rows]);

  // When we need custom, per row, styling, this is where we can defined the rules.
  // Add the class names above in the StyledDataGrid definition.
  const customRowStyler = (params: GridRowParams<any>) => {
    if (params.row.isGerminating) return 'germinating-row';
    return '';
  };

  return (
    <Card
      sx={{
        border: onlyTable ? '0px solid' : undefined,
        backgroundColor: onlyTable ? 'transparent' : undefined,
      }}
    >
      {!onlyTable && (
        <Row
          p={2}
          justifyContent="space-between"
          sx={{ borderBottom: '0.5px solid', borderColor: 'divider' }}
        >
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
        <StyledDataGrid
          columns={columns}
          rows={rows}
          pageSize={maxRows}
          disableSelectionOnClick
          disableColumnMenu
          density="compact"
          hideFooter={hideFooter}
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
          getRowClassName={customRowStyler}
        />
      </Box>
      {footNote && (
        <Box
          sx={{
            pt: 0.5,
            px: 2,
            pb: 1,
            color: 'text.tertiary',
          }}
        >
          *{footNote}
        </Box>
      )}
    </Card>
  );
};

export default TableCard;
