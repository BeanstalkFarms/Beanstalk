import React from 'react';
import BigNumber from 'bignumber.js';
import { Stack, Typography } from '@mui/material';
import { displayBN } from '~/util';
import { SPROUTS, RINSABLE_SPROUTS } from '~/constants/tokens';
import TokenIcon from '../Common/TokenIcon';
import Row from '~/components/Common/Row';

export type FertilizerTooltip = {
  name?: string;
  humidity: string;
  fertilizer: string;
  reward: any;
}

export const BUY_FERTILIZER: FertilizerTooltip = {
  name: 'buy-fertilizer',
  humidity: 'Humidity, the interest rate on buying Fertilizer.',
  fertilizer: '1 FERT = 1 USDC put into the Barn Raise.',
  reward: 'The number of Beans to be earned from this Fertilizer.'
};

export const MY_FERTILIZER: FertilizerTooltip = {
  name: 'my-fertilizer',
  humidity: 'Humidity',
  fertilizer: '1 FERT = 1 USDC put into the Barn Raise.',
  reward: (fertilized: BigNumber, unfertilized: BigNumber) => ((
    <Stack width={200}>
      <Row justifyContent="space-between">
        <Typography>Sprouts:</Typography>
        <Row alignItems="center" gap={0.2}>
          <TokenIcon token={SPROUTS} css={{ width: '14px' }} />
          <Typography>{displayBN(unfertilized)}</Typography>
        </Row>
      </Row>
      <Row justifyContent="space-between">
        <Typography>Rinsable Sprouts:</Typography>
        <Row alignItems="center" gap={0.2}>
          <TokenIcon token={RINSABLE_SPROUTS} css={{ width: '14px' }} />
          <Typography>{displayBN(fertilized)}</Typography>
        </Row>
      </Row>
    </Stack>
  ))
};
