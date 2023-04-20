import React from 'react';
import { MenuItem, StackProps, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { RouteData } from './routes';
import { FontSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';

/**
 * Use for mobile nav.
 *
 */
import { FC } from '~/types';

const NavItemMobile: FC<{
  /**
   * Add an adornment to the MenuItem,
   * such as a dropdown arrow.
   */
  endAdornment?: React.ReactElement,
  item: RouteData;
  onClick: () => void,
} & StackProps> = ({
  item,
  endAdornment,
  onClick,
}) => (
  <MenuItem
    disabled={item.disabled}
    component={item.href ? 'a' : RouterLink}
    key={item.path}
    href={item.href ? item.href : undefined}
    to={item.href ? undefined : item.path}
    target={item.href ? '_blank' : undefined}
    rel={item.href ? 'noreferrer' : undefined}
    sx={{ py: item.small ? 0.75 : 2, minWidth: 250, height: '100%', width: '100%' }}
    onClick={onClick}
    disableRipple
  >
    <Row justifyContent="space-between" spacing={0.5} width="100%">
      <Typography sx={{ fontSize: item.small ? FontSize.lg : FontSize['2xl'] }} variant="body1" color="text.primary">
        {item.title}
      </Typography>
      {item.href ? (
        <Typography variant="body2" color="text.primary">
          <ArrowForwardIcon sx={{ transform: 'rotate(-45deg)', fontSize: item.small ? 12 : 16 }} />
        </Typography>
      ) : null}
      {endAdornment !== undefined && (
        <>
          {endAdornment}
        </>
      )}
    </Row>
  </MenuItem>
);

export default NavItemMobile;
