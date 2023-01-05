import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  ListItemText,
  MenuItem as MuiMenuItem, MenuItemProps, Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { RouteData } from './routes';
import { FontSize, IconSize } from '../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const MenuItem : FC<{
  item: RouteData;
  onClick?: (event: React.MouseEvent<any>) => void;
} & MenuItemProps> = ({
  item,
  onClick,
  sx
}) => (
  <MuiMenuItem
    disabled={item.disabled}
    component={item.href ? 'a' : RouterLink}
    key={item.path}
    href={item.href ? item.href : undefined}
    target={item.href ? '_blank' : undefined}
    rel={item.href ? 'noreferrer' : undefined}
    to={item.href ? undefined : item.path}
    sx={{ minWidth: 250, ...sx }}
    onClick={onClick}
    >
    {item.disabled ? (
      <Tooltip title={<>{item.title} will be available upon Unpause</>}>
        <span>
          <Row gap={1}>
            {item.icon && <img src={item.icon} alt={item.title} width={IconSize.small} />}
            <Typography variant="body1">{item.title}</Typography>
          </Row>
        </span>
      </Tooltip>
      ) : (
        <ListItemText>
          <Row gap={1}>
            {item.icon && <img src={item.icon} alt={item.title} width={IconSize.small} />}
            <Typography variant="body1">{item.title}</Typography>
          </Row>
        </ListItemText>
      )}
    {item.href ? (
      <Typography variant="body2" color="text.secondary">
        <ArrowForwardIcon sx={{ transform: 'rotate(-45deg)', fontSize: FontSize.base }} />
      </Typography>
      ) : null}
  </MuiMenuItem>
  );

export default MenuItem;
