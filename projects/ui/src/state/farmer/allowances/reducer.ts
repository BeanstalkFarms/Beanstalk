import { createReducer } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import {
  clearAllowances,
  updateAllowance, updateAllowances,
} from './actions';

export interface AllowanceState {
  [contractAddress: string]: {
    [tokenAddress: string]: BigNumber;
  };
}

export const initialState: AllowanceState = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(updateAllowance, (state, { payload }) => {
      if (!state[payload.contract]) state[payload.contract] = {};
      state[payload.contract][payload.token.address] = payload.allowance;
    })
    .addCase(updateAllowances, (state, { payload }) => {
      payload.forEach((elem) => {
        if (!state[elem.contract]) state[elem.contract] = {};
        state[elem.contract][elem.token.address] = elem.allowance;
      });
    })
    .addCase(clearAllowances, () => initialState)
);
