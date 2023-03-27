import React from 'react';

import { Box, Button, ButtonProps, lighten, Stack } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { FC } from '~/types';

import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';

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
          backgroundColor: selected
            ? 'primary.light'
            : lighten(BeanstalkPalette.lightestGreen, 0.4),
        },
      },
      '&.Mui-disabled': {
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
        <Box sx={{ maxWidth: FontSize.base, height: FontSize.base }}>
          <CheckCircleRoundedIcon
            sx={{
              borderRadius: '100%',
              border: `${selected ? 0 : 1}px solid`,
              borderColor: selected ? 'primary.main' : 'text.light',
              color: selected ? 'primary.main' : 'transparent',
              transform: `scale(${selected ? 1.2 : 1})`,
              width: '100%',
              height: 'auto',
            }}
          />
        </Box>
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
