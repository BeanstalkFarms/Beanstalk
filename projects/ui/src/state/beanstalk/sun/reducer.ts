import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import { getNextExpectedSunrise, Sun } from '.';
import { 
  setNextSunrise,
  setRemainingUntilSunrise,
  setAwaitingSunrise,
  updateSeason,
  updateSeasonTime,
  resetSun
} from './actions';

const getInitialState = () => {
  const nextSunrise = getNextExpectedSunrise();
  return {
    season: NEW_BN,
    seasonTime: NEW_BN,
    sunrise: {
      awaiting: false,
      next: nextSunrise,
      remaining: nextSunrise.diffNow(),
    }
  };
};

const initialState : Sun = getInitialState();

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetSun, () => getInitialState())
    .addCase(updateSeason, (state, { payload }) => {
      state.season = payload;
    })
    .addCase(updateSeasonTime, (state, { payload }) => {
      state.seasonTime = payload;
    })
    .addCase(setAwaitingSunrise, (state, { payload }) => {
      state.sunrise.awaiting = payload;
    })
    .addCase(setNextSunrise, (state, { payload }) => {
      state.sunrise.next = payload;
    })
    .addCase(setRemainingUntilSunrise, (state, { payload }) => {
      state.sunrise.remaining = payload;
    })
);
