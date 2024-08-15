import React from 'react';
import { Token } from '@beanstalk/sdk';
import { Alert, Button, Stack, Typography } from '@mui/material';
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
import TokenIcon from '../Common/TokenIcon';
import Fiat from '../Common/Fiat';
import { BeanstalkPalette, FontWeight } from '../App/muiTheme';

const TokenAbout = ({ token }: { token: Token }) => {
  const balances = useAppSelector((s) => s._beanstalk.silo.balances);
  const sdk = useSdk();

  const pools = usePools();
  const { data } = useSeedGauge();
  const { pctTotalTVD } = useTVD(token);

  const isPool = token.address in pools;

  const gaugePoints = data.gaugeData[token.address]?.gaugePoints || ZERO_BN;

  const underlying = isPool ? pools[token.address]?.underlying : undefined;
  // const totalBDV = Object.values(balances).reduce<BigNumber>(
  //   (prev, curr) => prev.plus(curr.TVD || ZERO_BN),
  //   ZERO_BN
  // );

  const amounts = balances[token.address];
  // const pctDeposited = amounts.TVD.div(totalBDV).times(100);
  console.log('pctTotalTVD: ', pctTotalTVD.toString());

  const isWell = sdk.pools.getWells().find((w) => w.address === token.address);

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
          {token.address}
        </Typography>
      </Row>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography variant="subtitle1">Total value Deposited</Typography>
        <Stack textAlign="right">
          <Row gap={0.25}>
            <TokenIcon token={token} />
            <Typography>
              {(amounts?.deposited?.amount || ZERO_BN).toFormat(
                2,
                BigNumber.ROUND_HALF_CEIL
              )}
            </Typography>
          </Row>
          <Typography variant="bodySmall" color="text.secondary">
            <Fiat
              token={token}
              amount={amounts?.deposited?.amount || ZERO_BN}
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
          <Row gap={0.5}>
            <TokenIcon token={token} css={{ height: '20px', mb: '2px' }} />
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
            }}
          >
            View liquidity
            <OpenInNewIcon
              sx={{ color: 'inherit', fontSize: 'inherit', ml: '4px' }}
            />
          </Button>
        </Alert>
      )}
    </Stack>
  );
};
export default TokenAbout;
