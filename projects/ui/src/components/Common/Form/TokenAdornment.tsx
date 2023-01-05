import React from 'react';
import {
  Box,
  Button,
  ButtonProps,
  InputAdornment,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Token from '~/classes/Token';
import { BeanstalkPalette, hexToRgba, IconSize } from '../../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

export type TokenAdornmentProps = (
  {
    token: Token;
    buttonLabel?: string | JSX.Element;
    iconSize?: keyof typeof IconSize;
    downArrowIconSize?: keyof typeof IconSize;
  } & ButtonProps
);

const TokenAdornment: FC<TokenAdornmentProps> = ({
  // Config
  token,
  // Button
  size,
  sx, 
  buttonLabel,
  disabled,
  onClick,
  iconSize: _iconSize = 'small',
  downArrowIconSize = 'small',
  ...props
}) => {
  const iconSize = (size && size === 'small' ? 'xs' : _iconSize);
  const textVariant = size && size === 'small' ? 'body2' : 'bodyMedium';
  return (
    <InputAdornment position="end">
      <Button
        variant="text"
        color="primary"
        size={size}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          border: '1px solid transparent',
          fontWeight: 'normal',
          ...sx,
        }}
        // If no click handler is provided, disable so that
        // no mouse events work (i.e. no hover bg)
        disabled={disabled || !onClick}
        onClick={onClick}
        {...props}
      >
        <Row gap={0.5}>
          {token.logo ? (
            <Box
              component="img"
              src={token.logo}
              alt=""
              sx={{
                minWidth: IconSize[iconSize],
                width: IconSize[iconSize],
                height: IconSize[iconSize],
              }}
            />
          ) : null}
          <Box sx={{ color: 'text.primary' }}>
            <Typography variant={textVariant} fontWeight="fontWeightRegular">
              {buttonLabel || token.symbol}
            </Typography>
          </Box>
          {onClick && (
            <KeyboardArrowDownIcon
              sx={{
                fontSize: downArrowIconSize || 18,
                color: hexToRgba(BeanstalkPalette.textBlue, 0.87)
                // color: hexToRgba(BeanstalkPalette.theme.winter.primary, 0.87)
              }}
            />
          )}
        </Row>
      </Button>
    </InputAdornment>
  );
};

export default TokenAdornment;
