import React from 'react';
import {
  Box,
  Stack,
  Tooltip,
  Typography,
  TypographyVariant,
} from '@mui/material';

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

type SizeProps = {
  size?: 'small' | 'medium';
};

type Props = {
  children: React.ReactNode;
} & SizeProps;

export default function TokenOutput({ children, size }: Props) {
  const isMedium = size === 'medium';

  const px = isMedium ? 2 : 1;
  const py = isMedium ? 2 : 0.5;
  const gap = isMedium ? 1 : 0.5;

  return (
    <EmbeddedCard sx={{ px: px, py: py }}>
      <Stack width="100%" gap={gap}>
        {children}
      </Stack>
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
  size?: 'small' | 'medium';
};

const formatBN = (value?: BigNumber, _decimals?: number, suffix?: string) => {
  if (!value) return '';
  const decimals = value.abs().gt(new BigNumber(1000000)) ? 0 : _decimals || 2;
  const prefix = value ? (value.gte(0) ? '+' : '-') : '';
  return `${prefix} ${displayFullBN(value.abs(), decimals, decimals)}${
    suffix || ''
  }`;
};

function TokenOutputRow({
  label,
  token,
  amount,
  amountSuffix,
  amountTooltip,
  description,
  descriptionTooltip,
  delta,
  deltaSuffix,
  size = 'medium',
}: TokenOutputRowProps) {
  const isMedium = size === 'medium';
  const boxSize = isMedium ? IconSize.medium : IconSize.small;
  const labelVariant = (
    isMedium ? 'subtitle1' : 'bodySmall'
  ) as TypographyVariant;
  const descriptionVariant = (
    isMedium ? 'bodySmall' : 'caption'
  ) as TypographyVariant;

  return (
    <Stack width="100%" gap={0}>
      <Row width="100%" justifyContent="space-between">
        <Row gap={0.5}>
          <IconWrapper boxSize={boxSize}>
            <TokenIcon
              token={token}
              css={{
                height: size === 'small' ? IconSize.xs : undefined,
              }}
            />
          </IconWrapper>
          <Typography variant={labelVariant} color="text.primary">
            {label || token.symbol}
          </Typography>
        </Row>
        <Tooltip title={amountTooltip || ''}>
          <Typography
            variant={labelVariant}
            sx={{
              color: amount.lt(0) ? BeanstalkPalette.trueRed : 'text.secondary',
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
                width: size === 'medium' ? IconSize.medium : IconSize.small,
                height: size === 'medium' ? FontSize.lg : FontSize.sm,
              }}
            />
            {description ? (
              <Typography
                variant={descriptionVariant}
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
            <Typography variant={descriptionVariant} color="text.tertiary">
              {typeof delta === 'string'
                ? delta
                : formatBN(delta, 2, deltaSuffix)}
            </Typography>
          ) : null}
        </Row>
      ) : null}
    </Stack>
  );
}

TokenOutput.Row = TokenOutputRow;
