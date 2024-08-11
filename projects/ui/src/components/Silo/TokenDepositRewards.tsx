import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { Token } from '@beanstalk/sdk';
import Row from '~/components/Common/Row';
import BigNumber from 'bignumber.js';
import { InfoOutlined } from '@mui/icons-material';
import { FontWeight } from '../App/muiTheme';

const TokenDepositRewards = ({ token }: { token: Token }) => {
  const seedReward = new BigNumber(token.rewards?.seeds?.toHuman() || '0');
  const stalkReward = new BigNumber(token.rewards?.stalk?.toHuman() || '0');

  return (
    <Stack gap={2}>
      <Row justifyContent="space-between">
        <Typography variant="h4" fontWeight={FontWeight.bold}>
          Rewards for Deposited {token.symbol}
        </Typography>
        <Button variant="outlined" size="small">
          View rewards over time
        </Button>
      </Row>
      <Typography variant="subtitle1">
        For each Bean deposited, you’ll receive
        <Typography component="span" fontWeight={FontWeight.bold}>
          {stalkReward.toFormat(0)} Stalk
        </Typography>
        and{' '}
        <Typography component="span" fontWeight={FontWeight.bold}>
          {seedReward.toFormat(6)} Seed.
        </Typography>
      </Typography>
      <Row justifyContent="space-between">
        <Alert
          color="info"
          icon={
            <InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
          }
        >
          <Typography color="text.secondary">
            You’ll receive new Beans when the Bean supply grows based on your
            Stalk.
          </Typography>
        </Alert>
        <Button variant="outlined" size="small">
          View Bean Supply
        </Button>
      </Row>
    </Stack>
  );
};

export default TokenDepositRewards;
