import React from 'react';
import { Stack, Typography } from '@mui/material';
import TokenIcon from '~/components/Common/TokenIcon';
import Fiat from '~/components/Common/Fiat';
import { FontWeight } from '~/components/App/muiTheme';
import { formatTV } from '~/util';
import { Token } from '@beanstalk/sdk';
import { useTokenDepositsContext } from './TokenDepositsContext';
import DepositsTable from './DepositsTable';

const TokenTransferDepositsHeader = () => {
  const { token, balances } = useTokenDepositsContext();
  const depositedAmount = balances?.amount;

  return (
    <Stack>
      <Typography variant="h1">
        <TokenIcon token={token} css={{ marginBottom: '-5px' }} />{' '}
        {formatTV(depositedAmount, 2)}
      </Typography>
      <Typography variant="subtitle1" fontWeight={FontWeight.bold}>
        <Fiat token={token} amount={depositedAmount} />
      </Typography>
    </Stack>
  );
};

type Props = {
  token: Token;
};

const TokenTransferDeposits = ({ token }: Props) => (
  <Stack alignSelf="center" width="100%">
    <TokenTransferDepositsHeader />
    <DepositsTable token={token} selectType="multi" />
  </Stack>
);

export default TokenTransferDeposits;
