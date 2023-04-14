import { Box, Card } from '@mui/material';
import React, { useMemo } from 'react';
import { DataGrid, DataGridProps } from '@mui/x-data-grid';
import { BeanstalkPalette } from '../App/muiTheme';
import { tableStyle } from '../Common/Table/styles';

import { FC } from '~/types';

export type SeasonsTableProps = {}

const MAX_ROWS = 5;

const SeasonsTable: FC<SeasonsTableProps & DataGridProps> = ({ columns, rows }) => {
  const tableHeight = useMemo(() => {
    if (!rows || rows.length === 0) return '200px';
    return Math.min(rows.length, MAX_ROWS) * 40 + 112;
  }, [rows]);
  return (
    <Card sx={{ p: 1 }}>
      <Box
        width="100%"
        height={tableHeight}
        sx={{
          ...tableStyle,
          '& .MuiDataGrid-row': {
            borderBottom: 1,
            borderColor: BeanstalkPalette.blue,
          },
          '& .MuiDataGrid-columnHeadersInner': {
            borderBottom: 2, // TODO: why 2 here but 1 above?
            borderColor: BeanstalkPalette.blue,
          }
        }}>
        <DataGrid
          columns={columns}
          rows={rows}
          pageSize={8}
          disableSelectionOnClick
          density="compact"
        />
      </Box>
    </Card>
  );
};

export default SeasonsTable;
