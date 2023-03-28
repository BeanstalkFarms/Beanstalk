import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import { BeanstalkSilo } from '.';
import { resetBeanstalkSilo, updateBeanstalkSilo } from './actions';

export const initialBeanstalkSilo : BeanstalkSilo = {
  // Balances
  balances: {},
  // Rewards
  beans: {
    total: NEW_BN,
    earned: NEW_BN,
  },
  stalk: {
    active: NEW_BN,
    earned: NEW_BN,
    grown: NEW_BN,
    total: NEW_BN,
  },
  seeds: {
    active: NEW_BN,
    earned: NEW_BN,
    total: NEW_BN,
  },
  roots: {
    total: NEW_BN, 
  },
  // Metadata
  withdrawSeasons: NEW_BN,
};

export default createReducer(initialBeanstalkSilo, (builder) =>
  builder
    .addCase(resetBeanstalkSilo, () => {
      console.debug('[beanstalk/silo/reducer] reset');
      return initialBeanstalkSilo;
    })
    .addCase(updateBeanstalkSilo, (state, { payload }) => {
      state.balances = payload.balances;
      state.beans = payload.beans;
      state.stalk = payload.stalk;
      state.seeds = payload.seeds;
      state.roots = payload.roots;
      state.withdrawSeasons = payload.withdrawSeasons;
    })
);
