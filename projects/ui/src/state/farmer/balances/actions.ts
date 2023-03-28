import { createAction } from '@reduxjs/toolkit';
import Token from '~/classes/Token';
import { Balance } from '.';

export type UpdateBalancePayload = {
  token: Token,
  balance: Balance;
};

export const updateBalances = createAction<UpdateBalancePayload[]>(
  'farmer/balances/updateMultiple'
);

export const updateBalance = createAction<UpdateBalancePayload>(
  'farmer/balances/update'
);

export const clearBalances = createAction(
  'farmer/balances/clear'
);
