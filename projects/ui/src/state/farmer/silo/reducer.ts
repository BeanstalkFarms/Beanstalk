import { createReducer } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { FarmerSilo } from '.';
import { resetFarmerSilo, updateFarmerSiloRewards, updateFarmerSiloBalances } from './actions';

const NEG1 = new BigNumber(-1);

export const initialFarmerSilo : FarmerSilo = {
  balances: {},
  beans: {
    earned: NEG1,
  },
  stalk: {
    active: NEG1,
    earned: NEG1,
    grown: NEG1,
    total: NEG1,
  },
  seeds: {
    active: NEG1,
    earned: NEG1,
    total: NEG1,
  },
  roots: {
    total: NEG1, 
  }
};

export default createReducer(initialFarmerSilo, (builder) =>
  builder
    .addCase(resetFarmerSilo, () => initialFarmerSilo)
    .addCase(updateFarmerSiloBalances, (state, { payload }) => {
      const addresses = Object.keys(payload);
      addresses.forEach((address) => {
        const a = address.toLowerCase();
        state.balances[a] = {
          ...state.balances[a],
          ...payload[address]
        };
      });
    })
    .addCase(updateFarmerSiloRewards, (state, { payload }) => {
      state.beans = payload.beans;
      state.stalk = payload.stalk;
      state.seeds = payload.seeds;
      state.roots = payload.roots;
    })
);
