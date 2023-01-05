import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN, ZERO_BN } from '~/constants';
import { BeanstalkBarn } from '.';
import { resetBarn, updateBarn } from './actions';

const initialState : BeanstalkBarn = {
  remaining:    ZERO_BN,
  totalRaised:  ZERO_BN,
  humidity:     NEW_BN,
  currentBpf:   NEW_BN,
  endBpf:       NEW_BN,
  recapFundedPct: NEW_BN,
  unfertilized: NEW_BN,
  fertilized:   NEW_BN,
};

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetBarn, () => initialState)
    .addCase(updateBarn, (_state, { payload }) => 
       ({ ...payload })
    )
);
