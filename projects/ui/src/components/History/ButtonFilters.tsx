import React from 'react';
import { Box, Typography } from '@mui/material';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const buttonStyle = {
  cursor: 'pointer',
  border: 1,
  pl: 1,
  pr: 1,
  pt: 0.5,
  pb: 0.5,
  borderRadius: '25px'
};

export interface ButtonTabsProps {
  title: string;
}

const ButtonFilters: FC<ButtonTabsProps> = () => (
  <Row gap={1}>
    <Box sx={buttonStyle}>
      <Typography>Silo</Typography>
    </Box>
    <Box sx={buttonStyle}>
      <Typography>Field</Typography>
    </Box>
    <Box sx={buttonStyle}>
      <Typography>Other</Typography>
    </Box>
  </Row>
);

export default ButtonFilters;
