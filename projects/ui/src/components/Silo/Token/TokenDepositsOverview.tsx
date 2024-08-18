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
import FarmerTokenDepositsTable from './FarmerTokenDepositsTable';
import { useTokenDepositsContext } from './TokenDepositsContext';

type ITokenDepositsOverview = {
  token: Token;
};

const TokenDepositsOverview = ({ token }: ITokenDepositsOverview) => {
  const farmerDeposits = useAppSelector((s) => s._farmer.silo.balances);
  const deposits = farmerDeposits[token.address];
  const { setSlug } = useTokenDepositsContext();

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
              {(deposits?.deposited?.amount || ZERO_BN).toFormat(
                2,
                BigNumber.ROUND_HALF_DOWN
              )}
            </Typography>
            <Typography variant="h4">
              <Fiat
                amount={deposits?.deposited?.amount || ZERO_BN}
                token={token}
                defaultDisplay="-"
              />
            </Typography>
          </Stack>
        </Stack>
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
      </Stack>
      <FarmerTokenDepositsTable
        token={token}
        siloBalance={farmerDeposits[token.address]}
        selectType="single"
      />
    </Stack>
  );
};

export default TokenDepositsOverview;
