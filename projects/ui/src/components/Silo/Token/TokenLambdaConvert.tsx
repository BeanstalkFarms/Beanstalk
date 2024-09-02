import React, { useMemo } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { FontWeight } from '~/components/App/muiTheme';
import { ERC20Token } from '@beanstalk/sdk';
import useSdk from '~/hooks/sdk';
import { formatTV } from '~/util';
import Row from '~/components/Common/Row';
import useBDV from '~/hooks/beanstalk/useBDV';
import { useTokenDepositsContext } from './TokenDepositsContext';
import DepositConvertTable, {
  FarmerTokenConvertRow,
} from './DepositConvertTable';

const TokenLambdaConvert = ({ token }: { token: ERC20Token }) => {
  const sdk = useSdk();
  const { setWithIds, depositsById } = useTokenDepositsContext();
  const getBDV = useBDV();

  const updatableDeposits: FarmerTokenConvertRow[] = useMemo(() => {
    const oneTokenBDV = token.fromHuman(getBDV(token).toString());
    const updateable: FarmerTokenConvertRow[] = [];

    Object.entries(depositsById).forEach(([key, deposit]) => {
      const currentBDV = oneTokenBDV.mul(deposit.amount);
      const deltaBDV = currentBDV.sub(deposit.bdv);

      if (deposit.bdv.gte(currentBDV)) return;
      updateable.push({
        key,
        currentBDV: currentBDV,
        deltaBDV: deltaBDV,
        deltaStalk: sdk.tokens.STALK.fromHuman('50'), // FIX ME
        deltaSeed: sdk.tokens.SEEDS.fromHuman('100'), // FIX ME
        ...deposit,
      });
    });

    updateable.sort((a, b) => (a.deltaBDV.gte(b.deltaBDV) ? -1 : 1));

    return updateable;
  }, [depositsById, getBDV, token, sdk.tokens]);

  const handleSelectAll = () => {
    setWithIds(updatableDeposits.map(({ key }) => key));
  };

  const deltaStalk = sdk.tokens.STALK.fromHuman('50');
  const deltaSeed = sdk.tokens.SEEDS.fromHuman('100');

  return (
    <Stack>
      <Stack gap={2}>
        <Typography color="text.secondary">
          You can update your Deposits to use the current Bean Denominated Value
          of your Deposit for a{' '}
          <Typography component="span" fontWeight={FontWeight.bold}>
            gain in Stalk and Seed
          </Typography>
          .
        </Typography>
        <Typography>
          Bean Denominated Value (BDV) is the value of your Deposit measured in
          terms of Bean. This is used to calculate how many Stalk and Seed are
          rewarded to a Deposit. The BDV of your Deposits will change when the
          price of the underlying LP token changes.
        </Typography>
        <Stack>
          <Typography>
            Updating your deposits will net you a gain of:
          </Typography>
          <Typography
            variant="h3"
            fontWeight={FontWeight.bold}
            color="primary.main"
            lineHeight="30px"
          >
            + {formatTV(deltaStalk, 0)} STALK and {formatTV(deltaSeed, 0)} SEED
          </Typography>
        </Stack>
        <Divider sx={{ borderWidth: '0.5px' }} />
        <Row justifyContent="space-between" gap={2}>
          <Typography variant="subtitle1" color="text.secondary">
            Any deposits with a lower current BDV than BDV at deposit will not
            appear.
          </Typography>
          <Box
            onClick={handleSelectAll}
            sx={{ cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            <Typography
              variant="subtitle1"
              color="primary"
              sx={{ textDecoration: 'underline', whiteSpace: 'nowrap' }}
            >
              Select All
            </Typography>
          </Box>
        </Row>
      </Stack>
      <DepositConvertTable
        token={token}
        rows={updatableDeposits}
        selectType="multi"
      />
    </Stack>
  );
};

export default TokenLambdaConvert;
