import { createReducer } from '@reduxjs/toolkit';
import { ZERO_BN } from '~/constants';
import { FarmerField } from '.';
import { resetFarmerField, updateFarmerField } from './actions';

const initialState : FarmerField = {
  plots: {},
  harvestablePlots: {},
  pods: ZERO_BN,
  harvestablePods: ZERO_BN,
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetFarmerField, () => initialState)
    .addCase(updateFarmerField, (state, { payload }) => {
      state.plots = payload.plots;
      state.harvestablePlots = payload.harvestablePlots;
      state.pods = payload.pods;
      state.harvestablePods = payload.harvestablePods;
    })
);
