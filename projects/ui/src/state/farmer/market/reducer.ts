import { createReducer } from '@reduxjs/toolkit';
import { FarmerMarket } from '.';
import { resetFarmerMarket, updateFarmerMarket } from './actions';

const initialState : FarmerMarket = {
  listings: {},
  orders: {}
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetFarmerMarket, () => initialState)
    .addCase(updateFarmerMarket, (state, { payload }) => {
      state.listings = payload.listings;
      state.orders   = payload.orders;
    })
);
