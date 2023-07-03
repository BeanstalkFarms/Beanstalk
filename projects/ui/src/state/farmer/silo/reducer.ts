import { createReducer } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { FarmerSilo } from '.';
import {
  resetFarmerSilo,
  updateFarmerMigrationStatus,
  updateFarmerSiloBalances,
  updateLegacyFarmerSiloBalances,
  updateLegacyFarmerSiloRewards,
} from './actions';

const NEG1 = new BigNumber(-1);

export const initialFarmerSilo: FarmerSilo = {
  // Legacy balances
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
  },
  migrationNeeded: undefined,

  // New balances map
  _balances: new Map(),
};

export default createReducer(initialFarmerSilo, (builder) =>
  builder
    .addCase(resetFarmerSilo, () => initialFarmerSilo)
    .addCase(updateFarmerMigrationStatus, (state, { payload }) => {
      state.migrationNeeded = payload;
    })
    .addCase(updateLegacyFarmerSiloBalances, (state, { payload }) => {
      const addresses = Object.keys(payload);
      addresses.forEach((address) => {
        const a = address.toLowerCase();
        state.balances[a] = {
          ...state.balances[a],
          ...payload[address],
        };
      });
    })
    .addCase(updateLegacyFarmerSiloRewards, (state, { payload }) => {
      state.beans = payload.beans;
      state.stalk = payload.stalk;
      state.seeds = payload.seeds;
      state.roots = payload.roots;
    })
    .addCase(updateFarmerSiloBalances, (state, { payload }) => {
      state._balances = payload;
    })
);
