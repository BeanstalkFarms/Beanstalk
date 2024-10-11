import React from 'react';
import BigNumber from 'bignumber.js';
import { Box, Divider, Tooltip, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { DateTime } from 'luxon';
import useGasToUSD from '~/hooks/ledger/useGasToUSD';
import { AppState } from '~/state';
import { displayFullBN, displayUSD } from '~/util';

import { FC } from '~/types';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { ZERO_BN } from '~/constants';

const WEI_TO_GWEI = new BigNumber(10).pow(9);

const GasTag: FC<{
  gasLimit: BigNumber | null;
  px?: number;
}> = ({ gasLimit, px = 1 }) => {
  const prices = useSelector<AppState, AppState['app']['ethPrices']>(
    (state) => state.app.ethPrices
  );
  const getGasUSD = useGasToUSD();
  const gasUSD = gasLimit ? getGasUSD(gasLimit) : null;

  const baseFeeInWei = prices?.baseFeePerGas ?? ZERO_BN;
  const baseFeeGwei = baseFeeInWei.div(WEI_TO_GWEI);

  return (
    <Tooltip
      title={
        <>
          <StatHorizontal label="Gas limit">
            {gasLimit ? displayFullBN(gasLimit) : '?'}
          </StatHorizontal>
          <StatHorizontal label="Base fee">
            {baseFeeGwei?.gt(0)
              ? `${baseFeeGwei.toExponential(2, BigNumber.ROUND_UP)} gwei`
              : '?'}
          </StatHorizontal>
          <StatHorizontal label="ETH price">
            {prices?.ethusd ? `$${prices.ethusd}` : '?'}
          </StatHorizontal>
          {prices?.lastRefreshed && (
            <>
              <Divider color="secondary" sx={{ my: 1 }} />
              <Typography variant="bodySmall" color="gray">
                Refreshed at{' '}
                {DateTime.fromMillis(
                  parseInt(prices.lastRefreshed, 10)
                ).toLocaleString(DateTime.TIME_24_WITH_SHORT_OFFSET)}
              </Typography>
            </>
          )}
        </>
      }
    >
      <Box sx={{ px: px, py: 0.5, textAlign: 'right' }}>
        ⛽&nbsp;{gasUSD && !gasUSD.isNaN() ? displayUSD(gasUSD) : '$-.--'}
      </Box>
    </Tooltip>
  );
};

export default GasTag;
