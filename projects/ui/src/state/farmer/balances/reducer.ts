import { createReducer } from '@reduxjs/toolkit';
import { getTokenIndex } from '~/util';
import { FarmerBalances } from '.';
import { clearBalances, updateBalance, updateBalances } from './actions';

export const initialState: FarmerBalances = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(updateBalance, (state, { payload }) => {
      state[getTokenIndex(payload.token)] = payload.balance;
    })
    .addCase(updateBalances, (state, { payload }) => {
      payload.forEach((elem) => {
        state[getTokenIndex(elem.token)] = elem.balance;
      });
    })
    .addCase(clearBalances, () => initialState)
);
