import React from 'react';
import { Token } from '@beanstalk/sdk';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Link } from 'react-router-dom';
import Row from '~/components/Common/Row';
import { useAppSelector } from '~/state';
import { BASIN_WELL_LINK, ZERO_BN } from '~/constants';
import { InfoOutlined } from '@mui/icons-material';
import usePools from '~/hooks/beanstalk/usePools';
import useSdk from '~/hooks/sdk';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import useTVD from '~/hooks/beanstalk/useTVD';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { trimAddress } from '~/util';
import TokenIcon from '../../Common/TokenIcon';
import Fiat from '../../Common/Fiat';
import { BeanstalkPalette, FontWeight } from '../../App/muiTheme';

const TokenAbout = ({ token }: { token: Token }) => {
  const balances = useAppSelector((s) => s._beanstalk.silo.balances);
  const sdk = useSdk();

  const pools = usePools();
  const { data } = useSeedGauge();
  const { pctTotalTVD } = useTVD(token);

  const isPool = token.address in pools;

  const gaugePoints = data.gaugeData[token.address]?.gaugePoints || ZERO_BN;

  const underlying = isPool ? pools[token.address]?.underlying : undefined;

  const amounts = balances[token.address];
  const deposited = amounts?.deposited.amount;

  const isWell = sdk.tokens.siloWhitelistedWellLPAddresses.find(
    (a) => a === token.address
  );

  return (
    <Stack gap={2}>
      <Typography variant="h4">About Deposited {token.symbol}</Typography>
      <Row justifyContent="space-between">
        <Typography variant="subtitle1">Token address</Typography>
        <Typography
          to={`https://etherscan.io/address/${token.address}`}
          rel="noopener noreferrer"
          target="_blank"
          component={Link}
          color="text.primary"
          sx={{ textDecoration: 'underline' }}
        >
          <Typography component="span" display={{ xs: 'none', md: 'inline' }}>
            {token.address}
          </Typography>
          <Typography component="span" display={{ xs: 'inline', md: 'none' }}>
            {trimAddress(token.address)}
          </Typography>
        </Typography>
      </Row>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography variant="subtitle1">Total value Deposited</Typography>
        <Stack textAlign="right">
          <Row gap={0.25}>
            <Typography>
              <TokenIcon token={token} css={{ marginBottom: '-2px' }} />{' '}
              {deposited?.toFormat(2, BigNumber.ROUND_DOWN) ?? '-'}
            </Typography>
          </Row>
          <Typography variant="bodySmall" color="text.secondary">
            <Fiat
              token={token}
              amount={amounts?.deposited?.amount}
              defaultDisplay="-"
            />
          </Typography>
        </Stack>
      </Row>
      <Row justifyContent="space-between">
        <Typography variant="subtitle1">
          % of all value Deposited in the Silo
        </Typography>
        <Typography>
          {pctTotalTVD?.lt(0.01)
            ? '<0.01'
            : pctTotalTVD.toFormat(2, BigNumber.ROUND_DOWN)}
          %
        </Typography>
      </Row>
      {isWell && (
        <Row justifyContent="space-between">
          <Typography variant="subtitle1">Gauge Points</Typography>
          <Typography>{gaugePoints.toFormat(0)}</Typography>
        </Row>
      )}
      {underlying && isWell && (
        <Alert
          color="info"
          icon={
            <InfoOutlined sx={{ fontSize: '1rem', color: 'text.secondary' }} />
          }
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
          <Row gap={0.5} alignItems="flex-start">
            <InfoOutlined
              sx={{
                fontSize: '1rem',
                color: 'text.secondary',
                mt: 0.1,
              }}
            />
            <Box display={{ xs: 'none', md: 'block' }}>
              <TokenIcon token={token} css={{ height: '20px' }} />
            </Box>
            <Typography color="text.secondary" fontWeight={FontWeight.medium}>
              {token.symbol} is the liquidity Well token for{' '}
              {underlying[0]?.symbol} and {underlying[1]?.symbol}.
            </Typography>
          </Row>
          <Button
            variant="outlined-secondary"
            color="secondary"
            size="small"
            component={Link}
            to={`${BASIN_WELL_LINK}${token.address}`}
            rel="noopener noreferrer"
            target="_blank"
            sx={{
              borderRadius: '4px',
              width: 'fit-content',
              fontWeight: FontWeight.medium,
              px: 1,
              py: 0.75,
            }}
          >
            <Typography>
              View liquidity{' '}
              <OpenInNewIcon
                sx={{ color: 'inherit', fontSize: 'inherit', mb: -0.3 }}
              />
            </Typography>
          </Button>
        </Alert>
      )}
    </Stack>
  );
};
export default TokenAbout;
