import React from 'react';

import { Chip, styled, Tab, TabProps } from '@mui/material';
import { Token } from 'graphql';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

export const ChipLabel : FC<{ name: string; token?: Token }> = ({ name, children }) => (
  <Row gap={0.2}>
    {name}&nbsp;
    <Chip 
      label={children} 
      size="small" 
      color="primary"
      sx={{ 
        fontWeight: 'bold', 
        // background: BeanstalkPalette.theme.winter.primaryHover, 
        // color: 'primary.main' 
      }} 
    />
  </Row>
); 

/**
 * Chips contained in a Tab respond to hover events and change
 * colors when the parent Tab is selected.
 */
export const StyledTab = styled((props: TabProps) => (
  <Tab {...props} />
))(() => ({
  root: {
    opacity: 1,
  },
  '&:hover': {
    cursor: 'pointer'
  },
  '& .MuiChip-label': {
    opacity: 0.7,
  },
  '&:hover .MuiChip-label, &.Mui-selected .MuiChip-label': {
    opacity: 1,
  },
  '& .MuiChip-root:hover': {
    cursor: 'pointer'
  }
  // '&.Mui-selected .MuiChip-root': {},
}));
