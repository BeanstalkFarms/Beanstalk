import { createReducer } from '@reduxjs/toolkit';
import { DateTime } from 'luxon';
import { FarmerDelegation } from '.';

import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';
import { GovSpace } from '~/lib/Beanstalk/Governance';

const initialState: FarmerDelegation = {
  delegators: {},
  delegates: {},
  votingPower: {},
  updated: {
    delegators: undefined,
    delegates: undefined,
    stalk: undefined,
    nft: undefined,
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
      state.votingPower[payload.space] = payload.data;
      if (payload.space === GovSpace.BeanNFT) {
        state.updated.nft = DateTime.now();
      } else {
        state.updated.stalk = DateTime.now();
      }
    })
);
