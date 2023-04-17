import { createReducer } from '@reduxjs/toolkit';
import { BeanstalkGovernance } from '.';
import {
  resetBeanstalkGovernance,
  updateActiveProposals,
  updateMultisigBalances
} from './actions';

const initialState : BeanstalkGovernance = {
  activeProposals: [],
  multisigBalances: {}
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetBeanstalkGovernance, () => initialState)
    .addCase(updateActiveProposals, (state, { payload }) => {
      state.activeProposals = payload;
    })
    .addCase(updateMultisigBalances, (state, { payload }) => {
      state.multisigBalances = payload;
    })
);
