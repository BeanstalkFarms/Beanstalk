import { createReducer } from '@reduxjs/toolkit';
import { FarmerBalances } from '.';
import { clearBalances, updateBalance, updateBalances } from './actions';

export const initialState: FarmerBalances = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(updateBalance, (state, { payload }) => {
      state[payload.token.address] = payload.balance;
    })
    .addCase(updateBalances, (state, { payload }) => {
      payload.forEach((elem) => {
        state[elem.token.address] = elem.balance;
      });
    })
    .addCase(clearBalances, () => initialState)
);
