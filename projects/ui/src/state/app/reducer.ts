import { createReducer } from '@reduxjs/toolkit';
import { DataSource } from '@beanstalk/sdk';
import { SGEnvironments } from '~/graph/endpoints';
import { persistedState } from '~/state/persist';
import { App } from '.';
import { setGasPrices, setGlobal, updateSetting } from './actions';

export const initialState: App = {
  ethPrices: null,
  settings: {
    denomination: 'usd',
    subgraphEnv: SGEnvironments.BF_PROD,
    datasource: DataSource.LEDGER,
    impersonatedAccount: undefined,
    ...persistedState?.app?.settings,
  },
  globals: {
    showSettings: false,
  },
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(setGasPrices, (state, { payload }) => {
      state.ethPrices = payload;
    })
    .addCase(updateSetting, (state, { payload }) => {
      // @ts-ignore
      state.settings[payload.key] = payload.value;
    })
    .addCase(setGlobal, (state, { payload }) => {
      state.globals[payload.key] = payload.value;
    })
);
