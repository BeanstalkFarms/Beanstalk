import { Link, LinkProps } from '@mui/material';
import { Link as Link2 } from 'react-router-dom';
import React from 'react';
import { FontSize } from '~/components/App/muiTheme';

import { FC } from '~/types';

const sx = {
  color: '#333',
  fontSize: FontSize.sm,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  backgroundColor: 'white',
};

const Banner : FC<
  LinkProps
  & { height: number }
  & { to?: string } // fixme
> = ({
  height,
  children,
  to,
  ...props
}) => (
  to ? (
    <Link
      component={Link2}
      underline="none"
      to={to}
      sx={sx}
      height={height}
      {...props}
    >
      {children}
    </Link>
  ) : (
    <Link
      target="_blank"
      rel="noreferrer"
      underline="none"
      sx={sx}
      height={height}
      {...props}
    >
      {children}
    </Link>
  )
);

export default Banner;
