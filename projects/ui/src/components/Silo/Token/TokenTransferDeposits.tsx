import React from 'react';
import { ERC20Token } from '@beanstalk/sdk';
import CloseIcon from '@mui/icons-material/Close';
import { Button, Stack, Typography } from '@mui/material';
import TokenIcon from '~/components/Common/TokenIcon';
import Fiat from '~/components/Common/Fiat';
import Row from '~/components/Common/Row';
import { FontWeight } from '~/components/App/muiTheme';
import { formatTV } from '~/util';
import { useTokenDepositsContext } from './TokenDepositsContext';
import FarmerTokenDepositsTable from './FarmerTokenDepositsTable';

const TokenTransferDeposits = ({ token }: { token: ERC20Token }) => {
  const { setSlug, clear, selected, balances } = useTokenDepositsContext();

  const depositedAmount = balances?.amount;

  return (
    <Stack
      alignSelf="center"
      width="100%"
      maxWidth={!selected.size ? '838px' : '100%'}
    >
      <Row justifyContent="space-between" pb={1.5}>
        <Typography variant="h4">Select Deposits to Transfer</Typography>
        <Button
          variant="outlined-secondary"
          color="secondary"
          size="small"
          endIcon={<CloseIcon fontSize="inherit" />}
          onClick={() => setSlug('token', clear)}
        >
          Close
        </Button>
      </Row>
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
