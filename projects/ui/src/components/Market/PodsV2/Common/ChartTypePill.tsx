import { Box, Paper, PaperProps, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import React, { useState } from 'react';
import {  FontSize, FontWeight } from '~/components/App/muiTheme';
import DropdownIcon from '~/components/Common/DropdownIcon';
import Row from '~/components/Common/Row';
import { marketChartTypeAtom } from '../info/atom-context';

type OverlaySxProps = {
  right?: number;
  top?: number;
  left?: number;
  bottom?: number;
};

const { bold } = FontWeight;

const ChartTypePill: React.FC<PaperProps & { pos: OverlaySxProps}> = ({ pos, ...paperProps }) => {
  const chartType = useAtomValue(marketChartTypeAtom);
  const { right, top, left, bottom } = pos;
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ position: 'absolute', right , top, left, bottom }}>
      <Paper {...paperProps} sx={{ position: 'relative', borderRadius: '8px', border: '1px solid', borderColor: 'divider', ...paperProps.sx }}>
        <Typography variant="bodySmall" fontWeight={bold} component="span">
          <Row p={0.8}>
            {chartType === 'depth' ? 'BEAN / POD DEPTH' : 'LISTING'}
            <DropdownIcon open={open} sx={{ fontSize: FontSize.base, fontWeight: bold, ml: 0.4 }} />
          </Row>
        </Typography>
      </Paper>
    </Box>
  );
};

export default ChartTypePill;
