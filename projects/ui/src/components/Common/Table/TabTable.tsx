import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { DataGrid, DataGridProps } from '@mui/x-data-grid';
import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';

import { FC } from '~/types';

const wellTableBaseStyle = {
  '& .MuiDataGrid-root': {
    outline: 'none',
    border: 'none',
    '& .MuiDataGrid-row.odd': {
      backgroundColor: '#F6FAFE'
    },
    '& .MuiDataGrid-iconSeparator': {
      display: 'none'
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 500,
      fontSize: FontSize.base,
      color: 'gray'
    },
    '& .MuiDataGrid-columnHeader:focus': {
      outline: 'none'
    },
    '& .MuiDataGrid-columnHeaderDraggableContainer:focus': {
      outline: 'none'
    },
    '& .MuiDataGrid-cellContent': {
      color: '#677166',
      fontSize: '18px'
    },
    '& .MuiDataGrid-cell': {
      outline: 'none',
      border: 'none',
      '&:focused': {
        border: 'none'
      }
    },
    '& .MuiDataGrid-cell:focus': {
      outline: 'none',
      border: 'none',
    },
    '& .MuiDataGrid-row': {
      // border: 1,
      // borderTop: 1,
      borderBottom: 1,
      borderColor: BeanstalkPalette.blue,
      py: 2.8,
      // mb: 0.8,
      alignItems: 'center',
      // cursor: 'pointer',
      width: 'calc(100% - 2.5px)',
      '&:hover': {
        background: 'transparent'
      }
    },
    '& .MuiDataGrid-footerContainer': {
      outline: 'none',
      borderBottom: 'none',
      borderTop: 'none',
      justifyContent: 'center'
    },
    '& .MuiDataGrid-columnHeaders': {
      outline: 'none',
      borderBottom: 2,
      borderColor: BeanstalkPalette.blue,
      fontSize: '18px',
      color: '#000000',
      '&:hover' : {
        outline: 'none !important'
      }
    },
    '& .MuiDataGrid-columnHeader': {
      outline: 'none',
      border: 'none'
    },
    '& .MuiDataGrid-columnHeaderTitleContainer': {
      outline: 'none',
    },
  }
};

const MAX_ROWS = 5;

export type MarketBaseTableProps = {
  maxRows?: number;
}

const TabTable: FC<
  MarketBaseTableProps &
  DataGridProps
> = ({
  rows,
  columns,
  maxRows,
  onRowClick,
  ...props
}) => {
  ///
  const tableHeight = useMemo(() => {
    if (!rows || rows.length === 0) return '300px';
    return 39 + 58 + Math.min(rows.length, maxRows || MAX_ROWS) * 58;
  }, [rows, maxRows]);

  return (
    <Box sx={{
      height: tableHeight,
      width: '100%',
      ...wellTableBaseStyle,
    }}>
      <DataGrid
        columns={columns}
        rows={rows}
        pageSize={maxRows || MAX_ROWS}
        disableSelectionOnClick
        // disableColumnMenu
        density="compact"
        onRowClick={onRowClick}
        initialState={{
          sorting: {
            sortModel: [{ field: 'placeInLine', sort: 'asc' }],
          }
        }}
        {...props}
      />
    </Box>
  );
};

export default TabTable;
