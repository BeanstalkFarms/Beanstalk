import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { deliveryBoxIcon, minimizeWindowIcon } from '~/img/icon';

import { useAppSelector } from '~/state';
import Fiat from '~/components/Common/Fiat';
import { FontWeight } from '~/components/App/muiTheme';
import TokenIcon from '~/components/Common/TokenIcon';

import { Token } from '@beanstalk/sdk';
import { ZERO_BN } from '~/constants';
import BigNumber from 'bignumber.js';
import TokenDeposits from './TokenDeposits';

type ITokenDepositsOverview = {
  token: Token;
};

const sharedButtonSx = {
  color: 'text.primary',
  borderColor: 'secondary',
  borderRadius: '4px',
  fontWeight: FontWeight.medium,
  px: 1,
  py: 0.75,
} as const;

const TokenDepositsOverview = ({ token }: ITokenDepositsOverview) => {
  const farmerDeposits = useAppSelector((s) => s._farmer.silo.balances);
  const deposits = farmerDeposits[token.address];

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
                css={{ height: '24px', marginBottom: '-3px' }}
              />{' '}
              {deposits?.deposited?.amount.toFormat(
                2,
                BigNumber.ROUND_HALF_DOWN
              ) || '0'}
            </Typography>
            <Typography variant="h4">
              <Fiat
                amount={deposits?.deposited?.amount || ZERO_BN}
                token={token}
              />
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button
            size="small"
            color="secondary"
            variant="outlined-secondary"
            sx={sharedButtonSx}
          >
            <Box
              component="img"
              src={minimizeWindowIcon}
              alt="silo-transfer-deposits"
              sx={{ mr: '4px' }}
            />
            Transfer Deposits
          </Button>
          <Button
            size="small"
            color="secondary"
            variant="outlined-secondary"
            sx={sharedButtonSx}
          >
            <Box
              component="img"
              src={deliveryBoxIcon}
              alt="silo-update-deposits"
              sx={{ mr: '4px' }}
            />
            Update Deposits
          </Button>
        </Stack>
      </Stack>
      <TokenDeposits
        token={token}
        siloBalance={farmerDeposits[token.address]}
        selectType="single"
      />
    </Stack>
  );
};

export default TokenDepositsOverview;
