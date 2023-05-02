import { createReducer } from '@reduxjs/toolkit';
import { DateTime } from 'luxon';
import { FarmerDelegation } from '.';

import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';

const initialState: FarmerDelegation = {
  delegators: {},
  delegates: {},
  delegatorVotingPower: {},
  updated: {
    delegators: undefined,
    delegates: undefined,
  },
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(setFarmerDelegators, (state, { payload }) => {
      state.delegators = payload;
      state.updated.delegators = DateTime.now();
    })
    .addCase(setFarmerDelegates, (state, { payload }) => {
      state.delegates = payload;
      state.updated.delegates = DateTime.now();
    })
    .addCase(setDelegatorsVotingPower, (state, { payload }) => {
      state.delegatorVotingPower[payload.space] = payload.votingPower;
    })
);
