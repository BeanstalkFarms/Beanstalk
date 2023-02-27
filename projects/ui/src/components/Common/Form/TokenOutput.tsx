import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';

import { Token } from '@beanstalk/sdk';

import BigNumber from 'bignumber.js';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import EmbeddedCard from '../EmbeddedCard';
import {
  BeanstalkPalette,
  FontSize,
  IconSize,
} from '~/components/App/muiTheme';
import { displayFullBN } from '~/util';
import IconWrapper from '../IconWrapper';
import Row from '../Row';
import TokenIcon from '../TokenIcon';

type Props = {
  children: React.ReactNode;
};

export default function TokenOutput({ children }: Props) {
  return (
    <EmbeddedCard sx={{ p: 2 }}>
      <Stack gap={1}>{children}</Stack>
    </EmbeddedCard>
  );
}

type TokenOutputRowProps = {
  label?: string;
  token: Token;
  amount: BigNumber;
  amountTooltip?: string | JSX.Element;
  amountSuffix?: string;
  description?: string;
  descriptionTooltip?: string;
  delta?: BigNumber | string;
  deltaSuffix?: string;
};

const formatBN = (value?: BigNumber, _decimals?: number, suffix?: string) => {
  if (!value) return '';
  const decimals = value.abs().gt(new BigNumber(1000000)) ? 0 : _decimals || 2;
  const prefix = value ? (value.gte(0) ? '+' : '-') : '';
  return `${prefix} ${displayFullBN(value.abs(), decimals, decimals)}${
    suffix || ''
  }`;
};

TokenOutput.Row = function TokenOutputRow({
  label,
  token,
  amount,
  amountSuffix,
  amountTooltip,
  description,
  descriptionTooltip,
  delta,
  deltaSuffix,
}: TokenOutputRowProps) {
  return (
    <Stack width="100%" gap={0}>
      <Row width="100%" justifyContent="space-between">
        <Row gap={0.5}>
          <IconWrapper boxSize={IconSize.medium}>
            <TokenIcon token={token} />
          </IconWrapper>
          <Typography variant="subtitle1" color="text.primary">
            {label || token.symbol}
          </Typography>
        </Row>
        <Tooltip title={amountTooltip || ''}>
          <Typography
            variant="subtitle1"
            sx={{
                color: amount.lt(0)
                  ? BeanstalkPalette.trueRed
                  : 'text.secondary',
                textAlign: 'right',
              }}
            >
            {formatBN(amount, token.displayDecimals, amountSuffix)}
          </Typography>
        </Tooltip>
      </Row>
      {description || delta ? (
        <Row width="100%" justifyContent="space-between">
          <Row gap={0.5}>
            <Box
              sx={{
                width: IconSize.medium,
                height: FontSize.lg,
              }}
            />
            {description ? (
              <Typography
                variant="bodySmall"
                color="text.secondary"
                textAlign="right"
              >
                {description}
                {descriptionTooltip ? (
                  <Tooltip title={descriptionTooltip || ''}>
                    <HelpOutlineIcon
                      sx={{
                        ml: 0.1,
                        color: 'text.secondary',
                        display: 'inline',
                        mb: 0.5,
                        fontSize: '11px',
                      }}
                    />
                  </Tooltip>
                ) : null}
              </Typography>
            ) : null}
          </Row>
          {delta ? (
            <Typography variant="bodySmall" color="text.tertiary">
              {typeof delta === 'string'
                ? delta
                : formatBN(delta, 2, deltaSuffix)}
            </Typography>
          ) : null}
        </Row>
      ) : null}
    </Stack>
  );
};
