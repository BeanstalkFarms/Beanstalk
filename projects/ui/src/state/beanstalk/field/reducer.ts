import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN, ZERO_BN } from '~/constants';
import { BeanstalkField } from '.';
import { resetBeanstalkField, updateBeanstalkField, updateHarvestableIndex } from './actions';

const initialState : BeanstalkField = {
  harvestableIndex: NEW_BN,
  podIndex: NEW_BN,
  podLine: ZERO_BN,
  soil: NEW_BN,
  weather: {
    didSowBelowMin: false,
    didSowFaster: false,
    lastDSoil: NEW_BN,
    lastSoilPercent: NEW_BN,
    lastSowTime: NEW_BN,
    nextSowTime: NEW_BN,
    startSoil: NEW_BN,
    yield: NEW_BN,
  },
  // FIXME: move under Weather?
  rain: {
    raining: false,
    rainStart: NEW_BN,
  },
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetBeanstalkField, () => initialState)
    .addCase(updateBeanstalkField, (state, { payload }) => {
      Object.keys(payload).forEach((key) => {
        const _k = key as keyof BeanstalkField;
        const _p = payload[_k];
        // @ts-ignore
        state[_k] = _p;
      });
    })
    .addCase(updateHarvestableIndex, (state, { payload }) => {
      state.harvestableIndex = payload;
    })
);
