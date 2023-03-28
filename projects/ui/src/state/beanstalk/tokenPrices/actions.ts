import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';

export const updateTokenPrices = createAction<{ [address: string]: BigNumber }>(
  'beanstalk/tokenPrcies/updatePrices'
);

export const resetTokenPrices = createAction(
  'beanstalk/tokenPrices/resetPrices'
);
