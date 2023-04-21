import { createReducer, createSelector } from '@reduxjs/toolkit';
import { NEW_BN, ZERO_BN } from '~/constants';
import { BeanstalkField } from '.';
import {
  resetBeanstalkField,
  updateBeanstalkField,
  updateHarvestableIndex,
} from './actions';
import { AppState } from '~/state';

const initialState: BeanstalkField = {
  harvestableIndex: NEW_BN,
  podIndex: NEW_BN,
  podLine: ZERO_BN,
  soil: NEW_BN,
  weather: {
    lastDSoil: NEW_BN,
    lastSowTime: NEW_BN,
    thisSowTime: NEW_BN,
  },
  temperature: {
    max: NEW_BN,
    morning: NEW_BN,
  },
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetBeanstalkField, () => initialState)
    .addCase(updateBeanstalkField, (state, { payload }) => {
      Object.keys(payload).forEach((key) => {
        const _k = key as keyof Omit<BeanstalkField, 'morningBlock'>;
        const _p = payload[_k];
        // @ts-ignore
        state[_k] = _p;
      });
    })
    .addCase(updateHarvestableIndex, (state, { payload }) => {
      state.harvestableIndex = payload;
    })
);

const selectAppState = (state: AppState) => state;

export const selectBeanstalkField = createSelector(
  selectAppState,
  (state) => state._beanstalk.field
);
