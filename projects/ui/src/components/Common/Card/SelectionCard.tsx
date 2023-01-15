import React from 'react';

import { Box, Button, ButtonProps, Stack } from '@mui/material';
import { FC } from '~/types';

import SelectionIndicator from '~/components/Common/SelectionIndicator';

export type SelectionCardProps = {
  selected: boolean;
  toggle: () => void;
  indicatorPositionOffset?: number;
} & Omit<ButtonProps, 'onClick'>;

const SelectionCard: FC<SelectionCardProps> = ({
  children,
  selected,
  toggle,
  indicatorPositionOffset: posOffset = 10,
  disabled = false,
  ...props
}) => (
  <Button
    variant="outlined"
    fullWidth
    onClick={toggle}
    disabled={disabled}
    {...props}
    sx={{
      border: '1px solid',
      borderRadius: 1,
      ':not(.Mui-disabled)': {
        borderColor: selected ? 'primary.main' : 'text.light',
        backgroundColor: selected ? 'primary.light' : 'transparent',
        '&:hover': {
          backgroundColor: 'primary.light',
        },
      },
      '&.Mui-disabled': {
        opacity: 0.4,
        filter: `grayscale(${disabled ? 1 : 0})`,
      },
      p: 0,
      height: 'unset',
      minHeight: 0,
      boxSizing: 'border-box',
      ...props.sx,
    }}
  >
    <Stack sx={{ width: '100%', boxSizing: 'border-box', height: '100%' }}>
      <Box sx={{ position: 'absolute', top: posOffset, right: posOffset }}>
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
