import { createReducer } from '@reduxjs/toolkit';
import { resetTokenPrices, updateTokenPrices } from './actions';
import { TokenPrices } from './index';

const initialState: TokenPrices = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(updateTokenPrices, (state, { payload }) => {
      console.log('updating token prices...');
      return { ...payload };
    })
    .addCase(resetTokenPrices, () => ({ ...initialState }))
);
