import React from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { InfoOutlined } from '@mui/icons-material';
import { BeanstalkPalette, FontWeight } from '~/components/App/muiTheme';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const TokenDepositRewards = ({ token }: { token: Token }) => {
  const seedReward = new BigNumber(token.rewards?.seeds?.toHuman() || '0');
  const stalkReward = new BigNumber(token.rewards?.stalk?.toHuman() || '0');

  return (
    <Stack gap={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent={{ md: 'space-between' }}
        alignItems={{ md: 'center' }}
        gap={2}
      >
        <Typography variant="h4" fontWeight={FontWeight.bold}>
          Rewards for Deposited {token.symbol}
        </Typography>
        <Button
          variant="outlined-secondary"
          color="secondary"
          size="small"
          endIcon={<OpenInNewIcon sx={{ height: '16px', width: 'auto' }} />}
        >
          <Typography fontWeight="inherit">
            View rewards
            <Typography
              component="span"
              fontWeight="inherit"
              display={{ xs: 'none', md: 'inline' }}
            >
              {' over time '}
            </Typography>
          </Typography>
        </Button>
      </Stack>
      <Box>
        <Typography variant="subtitle1">
          For each Bean deposited, you&apos;ll receive{' '}
          <Typography component="span" fontWeight={FontWeight.bold}>
            {stalkReward.toFormat(0)} Stalk
          </Typography>
          {' and '}
          <Typography component="span" fontWeight={FontWeight.bold}>
            {seedReward.toFormat(6)} Seed.
          </Typography>
        </Typography>
      </Box>
      <Alert
        color="info"
        sx={(t) => ({
          background: BeanstalkPalette.lightestBlue,
          borderRadius: '10px',
          '& .MuiAlert-icon': {
            display: 'none',
          },
          '& .MuiAlert-message': {
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            justifyContent: 'space-between',
            alignItems: 'center',
            [t.breakpoints.down('md')]: {
              flexDirection: 'column',
              alignItems: 'flex-start',
            },
          },
        })}
      >
        <Typography color="text.secondary">
          <InfoOutlined
            sx={{
              fontSize: '1rem',
              color: 'text.secondary',
              mr: '4px',
              mb: -0.3,
            }}
          />
          You&apos;ll receive new Beans when the Bean supply grows based on your
          Stalk.
        </Typography>
        <Button
          variant="outlined-secondary"
          color="secondary"
          size="small"
          endIcon={<OpenInNewIcon sx={{ height: '16px', width: 'auto' }} />}
        >
          View Bean Supply
        </Button>
      </Alert>
    </Stack>
  );
};

export default TokenDepositRewards;
