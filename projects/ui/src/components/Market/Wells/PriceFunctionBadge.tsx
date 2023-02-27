import React from 'react';
import { Chip } from '@mui/material';
import {
  BeanstalkPalette,
  FontSize,
  FontWeight,
} from '~/components/App/muiTheme';

const PriceFunctionBadge: React.FC<{ name: string }> = ({ name }) => (
  <>
    <Chip
      label={name}
      size="small"
      sx={{
        backgroundColor: BeanstalkPalette.lightGreen,
        color: BeanstalkPalette.logoGreen,
        fontSize: FontSize.sm, // 16px
        fontWeight: FontWeight.semiBold,
        py: 0.5,
        px: 0.5,
      }}
    />
  </>
);

export default PriceFunctionBadge;
