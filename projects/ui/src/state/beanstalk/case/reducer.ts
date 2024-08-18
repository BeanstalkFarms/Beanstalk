import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ZERO_BN } from '~/constants';
import { BeanstalkCaseState, BeanstalkCaseTime } from '.';

interface IBeanstalkCaseState {
  caseState: BeanstalkCaseState;
  time: BeanstalkCaseTime;
}

const initialState = {
  caseState: {
    deltaPodDemand: ZERO_BN,
    l2sr: ZERO_BN,
    podRate: ZERO_BN,
    largestLiqWell: '',
    oracleFailure: false,
  },
  time: {
    time: 0,
    season: ZERO_BN,
  },
};

const beanstalkCaseSlice = createSlice({
  name: 'case',
  initialState,
  reducers: {
    updateBeanstalkCaseState(prev, action: PayloadAction<IBeanstalkCaseState>) {
      return {
        ...prev,
        caseState: action.payload.caseState,
        time: action.payload.time,
      };
    },
    setBeanstalkCaseState(prev, action: PayloadAction<BeanstalkCaseState>) {
      prev.caseState = action.payload;
    },
    setBeanstalkCaseTime(prev, action: PayloadAction<BeanstalkCaseTime>) {
      prev.time = action.payload;
    },
  },
});

export const {
  updateBeanstalkCaseState,
  setBeanstalkCaseState,
  setBeanstalkCaseTime,
} = beanstalkCaseSlice.actions;

export default beanstalkCaseSlice.reducer;
