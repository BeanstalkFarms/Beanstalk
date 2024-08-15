import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { Token } from '@beanstalk/sdk';
import Row from '~/components/Common/Row';
import BigNumber from 'bignumber.js';
import { InfoOutlined } from '@mui/icons-material';
import { BeanstalkPalette, FontWeight } from '~/components/App/muiTheme';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const TokenDepositRewards = ({ token }: { token: Token }) => {
  const seedReward = new BigNumber(token.rewards?.seeds?.toHuman() || '0');
  const stalkReward = new BigNumber(token.rewards?.stalk?.toHuman() || '0');

  return (
    <Stack gap={2}>
      <Row justifyContent="space-between">
        <Typography variant="h4" fontWeight={FontWeight.bold}>
          Rewards for Deposited {token.symbol}
        </Typography>
        <Button
          variant="outlined-secondary"
          color="secondary"
          size="small"
          sx={{
            borderRadius: '4px',
            width: 'fit-content',
            fontWeight: FontWeight.normal,
          }}
        >
          View rewards over time
          <OpenInNewIcon
            sx={{ color: 'inherit', fontSize: 'inherit', ml: '4px' }}
          />
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
      <Alert
        color="info"
        icon={
          <InfoOutlined
            fontSize="small"
            sx={{ fontSize: '1rem', color: 'text.secondary' }}
          />
        }
        sx={{
          background: BeanstalkPalette.lightestBlue,
          borderRadius: '10px',
          '& .MuiAlert-message': {
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        }}
      >
        <Typography color="text.secondary">
          You’ll receive new Beans when the Bean supply grows based on your
          Stalk.
        </Typography>
        <Button
          variant="outlined-secondary"
          color="secondary"
          size="small"
          sx={{
            borderRadius: '4px',
            width: 'fit-content',
            fontWeight: FontWeight.normal,
          }}
        >
          View Bean Supply
          <OpenInNewIcon
            sx={{ color: 'inherit', fontSize: 'inherit', ml: '4px' }}
          />
        </Button>
      </Alert>
    </Stack>
  );
};

export default TokenDepositRewards;
