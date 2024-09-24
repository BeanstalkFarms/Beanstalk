import React, { useMemo } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { FontWeight } from '~/components/App/muiTheme';
import { ERC20Token, TokenValue } from '@beanstalk/sdk';
import { formatTV } from '~/util';
import Row from '~/components/Common/Row';
import {
  UpdatableDepositsByToken,
  useTokenDepositsContext,
} from './TokenDepositsContext';
import DepositConvertTable from './DepositConvertTable';

const TokenLambdaConvert = ({
  token,
  updatableDeposits,
  totalDeltaStalk,
  totalDeltaSeed,
}: {
  token: ERC20Token;
  updatableDeposits: UpdatableDepositsByToken;
  totalDeltaStalk: TokenValue;
  totalDeltaSeed: TokenValue;
}) => {
  const { setWithIds } = useTokenDepositsContext();

  const rows = useMemo(
    () => Object.values(updatableDeposits),
    [updatableDeposits]
  );

  const handleSelectAll = () => {
    setWithIds(rows.map(({ key }) => key));
  };

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
            {formatTV(totalDeltaStalk, 2)} Stalk and{' '}
            {formatTV(totalDeltaSeed, 3)} Seeds
          </Typography>
        </Stack>
        <Divider sx={{ borderWidth: '0.5px' }} />
        <Row justifyContent="space-between" gap={2}>
          <Typography variant="subtitle1" color="text.secondary">
            Any deposits with a lower current BDV than BDV at deposit will not
            appear.
          </Typography>
          {!!updatableDeposits.length && (
            <Box
              onClick={handleSelectAll}
              sx={{
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              <Typography
                variant="subtitle1"
                color="primary"
                sx={{ textDecoration: 'underline', whiteSpace: 'nowrap' }}
              >
                Select All
              </Typography>
            </Box>
          )}
        </Row>
      </Stack>
      <DepositConvertTable token={token} rows={rows} selectType="multi" />
    </Stack>
  );
};

export default TokenLambdaConvert;
