import React from 'react';

import Check from '@mui/icons-material/Check';
import { Box, BoxProps } from '@mui/material';

import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';

import { remToPx } from '~/util/ui';

export type SelectionIndicatorProps = {
  selected: boolean;
  size?: keyof typeof FontSize | number;
} & BoxProps;

const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  selected,
  size: _size = 'base',
  sx,
}) => {
  const size = typeof _size === 'number' ? _size : remToPx(FontSize[_size]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
        borderRadius: '100%',
        backgroundColor: selected ? 'primary.main' : BeanstalkPalette.white,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : BeanstalkPalette.lightestGrey,
        boxSizing: 'border-box',
        ...sx,
      }}
    >
      {selected ? (
        <Check
          sx={{
            color: BeanstalkPalette.white,
            width: size * 0.75,
            height: 'auto',
          }}
        />
      ) : null}
    </Box>
  );
};

export default SelectionIndicator;
