import { createReducer } from '@reduxjs/toolkit';
import { BeanPools } from '.';
import { resetPools, updateBeanPool, updateBeanPools } from './actions';

const initialState : BeanPools = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(updateBeanPool, (state, { payload }) => {
      state[payload.address.toLowerCase()] = payload.pool;
    })
    .addCase(updateBeanPools, (state, { payload }) => {
      payload.forEach((pl) => {
        state[pl.address.toLowerCase()] = pl.pool;
      });
    })
    .addCase(resetPools, () => initialState)
);
