import React from 'react';
import { ERC20Token } from '@beanstalk/sdk';
import Row from '~/components/Common/Row';
import { Button, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TokenIcon from '~/components/Common/TokenIcon';
import { FarmerSiloTokenBalance } from '~/state/farmer/silo';
import { ZERO_BN } from '~/constants';
import Fiat from '~/components/Common/Fiat';
import { useTokenDepositsContext } from './TokenDepositsContext';
import FarmerTokenDepositsTable from './FarmerTokenDepositsTable';

const TokenTransferDeposits = ({
  token,
  siloBalance,
}: {
  token: ERC20Token;
  siloBalance: FarmerSiloTokenBalance;
}) => {
  const { setSlug, clear, selected } = useTokenDepositsContext();

  const depositedAmount = siloBalance?.deposited?.amount || ZERO_BN;

  return (
    <Stack
      gap={2}
      alignSelf="center"
      width="100%"
      maxWidth={!selected.size ? '838px' : '100%'}
    >
      <Row justifyContent="space-between">
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
          <TokenIcon token={token} />
          {depositedAmount.toFormat(2)}
        </Typography>
        <Typography variant="subtitle1">
          <Fiat token={token} amount={depositedAmount} />
        </Typography>
      </Stack>
      <FarmerTokenDepositsTable
        token={token}
        siloBalance={siloBalance}
        selectType="multi"
      />
    </Stack>
  );
};

export default TokenTransferDeposits;
