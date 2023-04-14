import React, { useRef } from 'react';
import { DataGrid, DataGridProps } from '@mui/x-data-grid';
import { Box, CircularProgress } from '@mui/material';
import { FC } from '~/types';
import { MarketBaseTableProps } from '~/components/Common/Table/TabTable';

import Centered from '~/components/Common/ZeroState/Centered';
import AuthEmptyState from '~/components/Common/ZeroState/AuthEmptyState';
import marketplaceTableStyle from '../Common/tableStyles';
import { BeanstalkPalette } from '~/components/App/muiTheme';

type IActivityTable = {
  /**
   * if it's a a generic market activity table or a user's activity table
   */
  isUserTable?: boolean;
  /**
   * message fragment to display when there is no data
   */
  title?: string;
  /**
   * async function to fetch more data on scroll
   */
  fetchMore?: () => Promise<void>;
};

const sizeMap = {
  0: 48, // closed
  1: 300, // half
  2: 750, // full
};

const EmptyOverlay: React.FC<{ message?: string; isUserTable?: boolean }> = ({
  message,
  isUserTable,
}) => {
  if (isUserTable && message) {
    return <AuthEmptyState message={message} hideWalletButton />;
  }
  return (
    <Centered>
      <CircularProgress />
    </Centered>
  );
};

// const TAB_CONTROL_HEIGHT = 52;

const BaseTable: FC<
  IActivityTable & MarketBaseTableProps & DataGridProps
> = ({
  rows,
  columns,
  maxRows,
  title,
  onRowClick,
  fetchMore,
  isUserTable = false,
  sortModel,
  ...props
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  return (
    <Box
      ref={scrollRef}
      sx={{
        // Container
        px: 0,
        height: '100%',
        width: '100%',
        // Table styles
        ...marketplaceTableStyle,
        '& .MuiDataGrid-row': {
          cursor: onRowClick ? 'pointer' : 'default',
        },
        '& .MuiDataGrid-columnHeaders': {
          borderBottom: `1px solid ${BeanstalkPalette.lightestGrey} !important`,
        },
        '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeaderTitle': {
          textTransform: 'uppercase'
        },
        '& .MuiDataGrid-footerContainer': {
          minHeight: 'auto',
          borderTop: `1px solid ${BeanstalkPalette.lightestGrey} !important`,
          justifyContent: 'flex-end !important'
        },
        '& .MuiDataGrid-footerContainer .MuiTablePagination-root .MuiToolbar-root': {
          minHeight: '0 !important',
          fontSize: 14
        },
        '& .MuiDataGrid-footerContainer .MuiTablePagination-root p': {
          my: 0,
          fontSize: 14
        }
      }}
    >
      <DataGrid
        rowHeight={40}
        disableSelectionOnClick
        headerHeight={40}
        columns={columns}
        rows={rows}
        pageSize={maxRows || 100}
        density="compact"
        onRowClick={onRowClick}
        initialState={{
          sorting: {
            sortModel: sortModel || [{ field: 'createdAt', sort: 'desc' }],
          },
        }}
        // Hide the rows per page selector
        rowsPerPageOptions={[]}
        components={{
          // We add pagination for now b/c Mui-DataGrid doesn't support maxRows > 100 if not on pro plan
          // Footer: ScrollPaginationControl,
          NoRowsOverlay: EmptyOverlay,
          LoadingOverlay: EmptyOverlay,
        }}
        componentsProps={{
          footer: {
            scrollRef,
            // handleFetchMore: fetchMore,
          },
          noRowsOverlay: {
            message: `Your ${title} will appear here`,
            isUserTable,
          },
        }}
        {...props}
        // disable loading
        loading={false}
      />
    </Box>
  );
};

export default BaseTable;
