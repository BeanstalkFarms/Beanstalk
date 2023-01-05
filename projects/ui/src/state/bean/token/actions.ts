import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';

export const updatePrice  = createAction<BigNumber>('bean/token/updatePrice');
export const updateSupply = createAction<BigNumber>('bean/token/updateSupply');
export const updateDeltaB = createAction<BigNumber>('bean/token/updateDeltaB');
