import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

import Fiat from '~/components/Common/Fiat';
import { FontWeight } from '~/components/App/muiTheme';
import TokenIcon from '~/components/Common/TokenIcon';

import { Token, TokenValue } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { deliveryBoxIcon, minimizeWindowIcon } from '~/img/icon';
import DepositsTable from './DepositsTable';
import { useTokenDepositsContext } from './TokenDepositsContext';

type Props = {
  token: Token;
};

const TokenDepositsOverview = ({ token }: Props) => {
  const { balances, setSlug } = useTokenDepositsContext();

  const depositedAmount = balances?.amount || TokenValue.ZERO;
  const amount = new BigNumber(depositedAmount.toHuman());

  const hasDeposits = Boolean(balances?.deposits?.length);

  return (
    <Stack>
      <Stack gap={2} p={1}>
        <Stack gap={1}>
          <Typography variant="h4" fontWeight={FontWeight.bold}>
            My Deposited {token.symbol}
          </Typography>
          <Stack>
            <Typography variant="h1">
              <TokenIcon
                token={token}
                css={{ height: '24px', marginBottom: '-1px' }}
              />{' '}
              {amount.toFormat(2, BigNumber.ROUND_DOWN)}
            </Typography>
            <Typography variant="h4">
              <Fiat amount={amount} token={token} defaultDisplay="-" />
            </Typography>
          </Stack>
        </Stack>
        {hasDeposits && (
          <Stack direction="row" gap={1}>
            <Button
              size="small"
              color="secondary"
              variant="outlined-secondary"
              startIcon={
                <Box
                  component="img"
                  src={minimizeWindowIcon}
                  height="16px"
                  width="auto"
                />
              }
              onClick={() => setSlug('transfer')}
            >
              Transfer
              <Typography
                component="span"
                fontWeight="inherit"
                display={{ xs: 'none', md: 'inline' }}
              >
                {' Deposits'}
              </Typography>
            </Button>
            <Button
              size="small"
              color="secondary"
              variant="outlined-secondary"
              startIcon={
                <Box
                  component="img"
                  src={deliveryBoxIcon}
                  height="20px"
                  width="auto"
                />
              }
              onClick={() => setSlug('lambda')}
            >
              Update
              <Typography
                fontWeight="inherit"
                component="span"
                display={{ xs: 'none', md: 'inline' }}
              >
                {' Deposits'}
              </Typography>
            </Button>
          </Stack>
        )}
      </Stack>
      <DepositsTable token={token} selectType="single" />
    </Stack>
  );
};

export default TokenDepositsOverview;

/**
 * Shorten an Silo Deposit Id for UI display.
 */
export function trimDepositId(
  address: string,
  options?: { start?: number; end?: number }
) {
  const start = options?.start || 4;
  const end = options?.end || 2;
  return `${address.substring(0, start)}${address ? `...${address.slice(-end)}` : ''}`;
}
