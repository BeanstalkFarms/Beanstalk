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
import Row from '~/components/Common/Row';
import AddressIcon from '../AddressIcon';

import { FC } from '~/types';
import { hexToRgba } from '~/util/ui';
import { BalanceFrom } from './BalanceFromRow';

export type TokenAdornmentProps = {
  token: Token;
  balanceFrom?: BalanceFrom;
  buttonLabel?: string | JSX.Element;
  iconSize?: keyof typeof IconSize;
  downArrowIconSize?: keyof typeof IconSize;
} & ButtonProps;

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
  balanceFrom,
  token,
  // Button
  size,
  disabled,
  buttonLabel,
  onClick,
  iconSize: _iconSize = 'small',
  downArrowIconSize = 'small',
  ...props
}) => {
  const iconSize = size && size === 'small' ? 'xs' : _iconSize;
  const textVariant = size && size === 'small' ? 'body2' : 'bodyMedium';

  return (
    <InputAdornment position="end">
      <Button
        id="token-adornment-button"
        {...props}
        // If no click handler is provided, disable so that
        // no mouse events work (i.e. no hover bg)
        disabled={disabled || !onClick}
        onClick={onClick}
        variant={!balanceFrom ? 'text' : 'outlined'}
        color={!balanceFrom ? 'primary' : undefined}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          fontWeight: 'normal',
          cursor: 'pointer',
          color: 'text.primary',
          boxSizing: 'border-box',
          ...(balanceFrom ? wrappedVariantSx : {}),
          ...props.sx,
        }}
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
          <Box>
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
                color: hexToRgba(BeanstalkPalette.textBlue, 0.87),
              }}
            />
          )}
        </Row>
      </Button>
    </InputAdornment>
  );
};

export default TokenAdornment;
