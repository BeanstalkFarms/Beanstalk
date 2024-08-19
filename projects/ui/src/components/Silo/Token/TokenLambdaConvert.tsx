import React from 'react';
import { Stack, Typography } from '@mui/material';
import { FontWeight } from '~/components/App/muiTheme';
import { ERC20Token } from '@beanstalk/sdk';

const TokenLambdaConvert = ({ token }: { token: ERC20Token }) => {
  const k = '';
  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Typography variant="h4">Update Deposits</Typography>
        <Typography color="text.secondary">
          You can update your Deposits to use the current Bean Denominated Value
          of your Deposit for a{' '}
          <Typography component="span" fontWeight={FontWeight.bold}>
            gain in Stalk and Seed
          </Typography>
          .
        </Typography>
      </Stack>
      <Typography>
        Bean Denominated Value (BDV) is the value of your Deposit measured in
        terms of Bean. This is used to calculate how many Stalk and Seed are
        rewarded to a Deposit. The BDV of your Deposits will change when the
        price of the underlying LP token changes.
      </Typography>
    </Stack>
  );
};

export default TokenLambdaConvert;
