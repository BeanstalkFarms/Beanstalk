import { Box, Divider, Tooltip, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React from 'react';
import { useSelector } from 'react-redux';
import { DateTime } from 'luxon';
import useGasToUSD from '~/hooks/ledger/useGasToUSD';
import { AppState } from '~/state';
import { displayUSD } from '~/util';

import { FC } from '~/types';
import StatHorizontal from '~/components/Common/StatHorizontal';

const GasTag : FC<{
  gasLimit: BigNumber | null;
}> = ({
  gasLimit
}) => {
  const prices    = useSelector<AppState, AppState['app']['ethPrices']>((state) => state.app.ethPrices);
  const getGasUSD = useGasToUSD();
  const gasUSD    = gasLimit ? getGasUSD(gasLimit) : null;
  return (
    <Tooltip title={(
      <>
        <StatHorizontal label="Gas limit">
          {gasLimit?.toString() || '?'}
        </StatHorizontal>
        <StatHorizontal label="Base fee">
          {prices?.gas.safe || '?'} gwei
        </StatHorizontal>
        <StatHorizontal label="ETH price">
          ${prices?.ethusd || '?'}
        </StatHorizontal>
        {prices?.lastRefreshed && (
          <>
            <Divider color="secondary" sx={{ my: 1 }} />
            <Typography variant="bodySmall" color="gray">
              Refreshed at {DateTime.fromMillis(parseInt(prices.lastRefreshed, 10)).toLocaleString(DateTime.TIME_24_WITH_SHORT_OFFSET)}
            </Typography>
          </>
        )}
      </>
    )}>
      <Box sx={{ px: 1, py: 0.5, minWidth: 80, textAlign: 'right' }}>
        ⛽&nbsp;{gasUSD && !gasUSD.isNaN() ? displayUSD(gasUSD) : '$-.--'}
      </Box>
    </Tooltip>
  );
};

export default GasTag;
