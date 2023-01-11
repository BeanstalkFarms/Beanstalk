import React from 'react';

import { Box, Button, Stack } from '@mui/material';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { FC } from '~/types';

import SelectionIndicator from './SelectionIndicator';

export type SelectionCardProps = {
  selected: boolean;
  toggle: () => void;
};

const SelectionCard: FC<SelectionCardProps> = ({
  children,
  selected,
  toggle,
}) => (
  <Button
    variant="outlined"
    fullWidth
    sx={{
      borderRadius: 1,
      border: '1px solid',
      borderColor: selected ? 'primary.main' : BeanstalkPalette.lightestGrey,
      background: selected ? BeanstalkPalette.hoverGreen : 'transparent',
      p: 0,
      height: 'unset',
      minHeight: 0,
      boxSizing: 'border-box',
      '&:hover': {
        background: BeanstalkPalette.hoverGreen,
      },
      '&. Mui-Selected': {
        border: '1px solid',
        background: 'primary.main',
      },
    }}
    onClick={toggle}
  >
    <Stack sx={{ width: '100%', boxSizing: 'border-box', height: '100%' }}>
      <Box sx={{ position: 'absolute', top: '10px', right: '10px' }}>
        <SelectionIndicator selected={selected} />
      </Box>
      <Box
        width="100%"
        sx={{
          boxSizing: 'border-box',
          p: 1,
        }}
      >
        {children}
      </Box>
    </Stack>
  </Button>
);

export default SelectionCard;
