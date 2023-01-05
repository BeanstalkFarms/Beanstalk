import { createReducer } from '@reduxjs/toolkit';
import { Unripe } from '.';
import { resetUnripe, updateUnripe } from './actions';

export const initialState : Unripe = {};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetUnripe, () => initialState)
    .addCase(updateUnripe, (state, { payload }) => {
      Object.keys(payload).forEach((addr) => {
        state[addr] = payload[addr];
      });
      return state;
    })
);
