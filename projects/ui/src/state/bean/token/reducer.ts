import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import { BeanToken } from '.';
import { updatePrice, updateSupply, updateDeltaB } from './actions';

const initialState : BeanToken = {
  price:  NEW_BN,
  supply: NEW_BN,
  deltaB: NEW_BN,
};

export default createReducer(initialState, (builder) => 
  builder
    .addCase(updatePrice, (state, { payload }) => {
      state.price = payload;
    })
    .addCase(updateSupply, (state, { payload }) => {
      state.supply = payload;
    })
    .addCase(updateDeltaB, (state, { payload }) => {
      state.deltaB = payload;
    })
);
