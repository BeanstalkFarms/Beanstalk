import { createReducer } from '@reduxjs/toolkit';
import { FarmerDelegation } from '.';

import {
  setDelegatorsVotingPower,
  setFarmerDelegates,
  setFarmerDelegators,
} from './actions';
import { GovSpace } from '~/lib/Beanstalk/Governance';

export const getDefaultGovSpaceMap = () => ({
  [GovSpace.BeanNFT]: {},
  [GovSpace.BeanSprout]: {},
  [GovSpace.BeanstalkDAO]: {},
  [GovSpace.BeanstalkFarms]: {},
});

const initialState: FarmerDelegation = {
  delegators: {
    users: getDefaultGovSpaceMap(),
    votingPower: getDefaultGovSpaceMap(),
  },
  delegates: {},
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(setFarmerDelegators, (state, { payload }) => {
      state.delegators.users = payload;
    })
    .addCase(setDelegatorsVotingPower, (state, { payload }) => {
      state.delegators.votingPower[payload.space] = payload.data;
    })
    .addCase(setFarmerDelegates, (state, { payload }) => {
      state.delegates = payload;
    })
);
