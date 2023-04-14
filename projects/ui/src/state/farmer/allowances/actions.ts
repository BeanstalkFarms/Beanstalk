import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { Token } from '~/classes';

export type UpdateAllowancePayload = {
  contract: string;
  token: Token,
  allowance: BigNumber
};

export const updateAllowances = createAction<UpdateAllowancePayload[]>(
  'farmer/allowances/updateAllowances'
);

export const updateAllowance = createAction<UpdateAllowancePayload>(
  'farmer/allowances/updateAllowance'
);

export const clearAllowances = createAction(
  'farmer/allowances/clearAllowances'
);
