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
import { BeanstalkPalette, IconSize } from '../../App/muiTheme';
import { hexToRgba } from '~/util/UI';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { BalanceFrom } from './BalanceFromRow';
import AddressIcon from '../AddressIcon';

export type TokenAdornmentProps = (
  {
    token: Token;
    balanceFrom?: BalanceFrom;
    buttonLabel?: string | JSX.Element;
    iconSize?: keyof typeof IconSize;
    downArrowIconSize?: keyof typeof IconSize;
  } & ButtonProps
);

const wrappedVariantSx = {
  px: 1,
  py: 0.1,
  height: 'unset',
  border: '1px solid',
  borderColor: 'text.light',
  ':hover': {
    borderColor: 'text.light',
    backgroundColor: BeanstalkPalette.lightestBlue
  }
};

const TokenAdornment: FC<TokenAdornmentProps> = ({
  // Config
  token,
  balanceFrom,
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
        variant={!balanceFrom ? 'text' : 'outlined'}
        color={!balanceFrom ? 'primary' : undefined}
        size={size}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          border: '1px solid transparent',
          fontWeight: 'normal',
          color: 'text.primary',
          boxSizing: 'border-box',
          ...(balanceFrom ? wrappedVariantSx : {}),
          ...sx,
        }}
        // If no click handler is provided, disable so that
        // no mouse events work (i.e. no hover bg)
        disabled={disabled || !onClick}
        onClick={onClick}
        {...props}
      >
        <Row gap={0.5}>
          {balanceFrom ? (
            <>
              {balanceFrom !== BalanceFrom.INTERNAL ? (
                <AddressIcon size={IconSize[iconSize]} />
              ) : null}
              {balanceFrom !== BalanceFrom.EXTERNAL ? (
                <Typography>🚜</Typography>
              ) : null}
              <Box
                sx={{
                  borderRight: `1px solid ${BeanstalkPalette.lightestGrey}`,
                  height: textVariant === 'body2' ? 12 : 16,
                  mx: 0.3,
                }}
              />
            </>
          ) : null}
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
            <Typography 
              variant={textVariant} 
              fontWeight="fontWeightRegular" 
              color="text.primary"
            >
              {buttonLabel || token.symbol}
            </Typography>
          </Box>
          {onClick && (
            <KeyboardArrowDownIcon
              sx={{
                fontSize: downArrowIconSize || 18,
                color: hexToRgba(BeanstalkPalette.textBlue, 0.87)
              }}
            />
          )}
        </Row>
      </Button>
    </InputAdornment>
  );
};

export default TokenAdornment;
