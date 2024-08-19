import React from 'react';
import { ERC20Token } from '@beanstalk/sdk';
import { Stack, Typography } from '@mui/material';
import TokenIcon from '~/components/Common/TokenIcon';
import Fiat from '~/components/Common/Fiat';
import { FontWeight } from '~/components/App/muiTheme';
import { formatTV } from '~/util';
import { useTokenDepositsContext } from './TokenDepositsContext';
import FarmerTokenDepositsTable from './FarmerTokenDepositsTable';

const TokenTransferDeposits = ({ token }: { token: ERC20Token }) => {
  const { selected, balances } = useTokenDepositsContext();

  const depositedAmount = balances?.amount;

  return (
    <Stack
      alignSelf="center"
      width="100%"
      maxWidth={!selected.size ? '838px' : '100%'}
    >
      <Stack>
        <Typography variant="h1">
          <TokenIcon token={token} css={{ marginBottom: '-5px' }} />{' '}
          {formatTV(depositedAmount, 2)}
        </Typography>
        <Typography variant="subtitle1" fontWeight={FontWeight.bold}>
          <Fiat token={token} amount={depositedAmount} />
        </Typography>
      </Stack>
      <FarmerTokenDepositsTable token={token} selectType="multi" />
    </Stack>
  );
};

export default TokenTransferDeposits;
