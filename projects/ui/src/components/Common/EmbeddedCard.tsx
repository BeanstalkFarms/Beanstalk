import React from 'react';
import { Card, CardProps } from '@mui/material';

import { FC } from '~/types';
import { BeanstalkPalette } from '../App/muiTheme';

const EmbeddedCard: FC<CardProps & { danger?: boolean }> = ({
  children,
  danger = false,
  ...cardProps
}) => (
  <Card
    {...cardProps}
    sx={{
      ...cardProps.sx,
      border: 'none',
      borderRadius: '6px !important',
      background: danger
        ? BeanstalkPalette.lightestRed
        : BeanstalkPalette.white,
    }}
  >
    {children}
  </Card>
);

export default EmbeddedCard;
