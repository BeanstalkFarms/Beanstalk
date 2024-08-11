import React from 'react';
import { Token } from '@beanstalk/sdk';
import { Alert, Button, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Link } from 'react-router-dom';
import Row from '~/components/Common/Row';
import { useAppSelector } from '~/state';
import { ZERO_BN } from '~/constants';
import { InfoOutlined } from '@mui/icons-material';
import usePools from '~/hooks/beanstalk/usePools';
import useSdk from '~/hooks/sdk';
import TokenIcon from '../Common/TokenIcon';
import Fiat from '../Common/Fiat';

const SiloTokenAbout = ({ token }: { token: Token }) => {
  const balances = useAppSelector((s) => s._beanstalk.silo.balances);
  const sdk = useSdk();

  const pools = usePools();

  const underlying = pools[token.address].underlying;
  const totalBDV = Object.values(balances).reduce<BigNumber>(
    (prev, curr) => prev.plus(curr.TVD),
    ZERO_BN
  );

  const amounts = balances[token.address];
  const pctDeposited = amounts.TVD.div(totalBDV).times(100);

  const isWell = sdk.pools.getWells().find((w) => w.address === token.address);

  return (
    <Stack gap={2}>
      <Typography variant="h4">About Deposited {token.symbol}</Typography>
      <Row justifyContent="space-between">
        <Typography variant="subtitle1" color="text.secondary">
          Token address
        </Typography>
        <Typography
          to={`https://etherscan.io/address/${token.address}`}
          rel="noopener noreferrer"
          target="_blank"
          component={Link}
          variant="subtitle1"
          color="text.secondary"
          sx={{ textDecoration: 'underline' }}
        >
          {token.address}
        </Typography>
      </Row>
      <Row justifyContent="space-between" alignItems="flex-start">
        <Typography variant="subtitle1">Total value Deposited</Typography>
        <Stack>
          <Row gap={0.25}>
            <TokenIcon token={token} />
            <Typography>
              {amounts.deposited.amount.toFormat(2, BigNumber.ROUND_HALF_CEIL)}
            </Typography>
          </Row>
          <Typography variant="bodySmall" color="text.secondary">
            <Fiat token={token} amount={amounts.deposited.amount || ZERO_BN} />
          </Typography>
        </Stack>
      </Row>
      <Row justifyContent="space-between">
        <Typography variant="subtitle1">
          % of all value Deposited in the Silo
        </Typography>
        <Typography>
          {pctDeposited.toFormat(2, BigNumber.ROUND_HALF_DOWN)}%
        </Typography>
      </Row>
      <Row justifyContent="space-between">
        <Typography variant="subtitle1">Gauge Points</Typography>
        <Typography>TODO</Typography>
      </Row>
      <Row>
        <Alert color="info" icon={<InfoOutlined fontSize="small" />}>
          <Row gap={0.25}>
            <TokenIcon token={token} />
            <Typography>
              {token.symbol} is the liquidity Well token for{' '}
              {underlying[0]?.symbol} and {underlying[1]?.symbol}.
            </Typography>
          </Row>
        </Alert>
        {isWell && (
          <Button
            variant="outlined"
            size="small"
            component={Link}
            to={`BASIN_WELL_LINK/${token.address}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            View liquidity (TODO)
          </Button>
        )}
      </Row>
    </Stack>
  );
};
export default SiloTokenAbout;
