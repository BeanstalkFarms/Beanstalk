import React from 'react';

import Check from '@mui/icons-material/Check';
import { BoxProps, Stack } from '@mui/material';

import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';

import { remToPx } from '~/util/UI';

export type SelectionIndicatorProps = {
  selected: boolean;
  size?: keyof typeof FontSize | number;
} & BoxProps;

const SIZE_MULTIPLIER = 0.75;

const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  selected,
  size: _size = 'base',
  sx,
}) => {
  const size = typeof _size === 'number' ? _size : remToPx(FontSize[_size]);

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      width={size}
      height="auto"
      sx={{
        aspectRatio: '1',
        borderRadius: '100%',
        backgroundColor: selected ? 'primary.main' : 'light.main',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'text.light',
        boxSizing: 'border-box',
        ...sx,
      }}
    >
      {selected ? (
        <Check
          sx={{
            color: BeanstalkPalette.white,
            width: size * SIZE_MULTIPLIER,
            height: 'auto',
          }}
        />
      ) : null}
    </Stack>
  );
};

export default SelectionIndicator;
