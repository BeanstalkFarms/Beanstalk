import { createReducer, createSelector } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import { getNextExpectedSunrise, Sun } from '.';
import {
  setNextSunrise,
  setRemainingUntilSunrise,
  setAwaitingSunrise,
  updateSeasonTime,
  resetSun,
  updateSeasonResult,
} from './actions';

const getInitialState = () => {
  const nextSunrise = getNextExpectedSunrise();
  return {
    seasonTime: NEW_BN,
    sunrise: {
      awaiting: false,
      next: nextSunrise,
      remaining: nextSunrise.diffNow(),
    },
    season: {
      current: NEW_BN,
      lastSop: NEW_BN,
      withdrawSeasons: NEW_BN,
      lastSopSeason: NEW_BN,
      rainStart: NEW_BN,
      raining: false,
      fertilizing: false,
      sunriseBlock: NEW_BN,
      abovePeg: false,
      start: NEW_BN,
      period: NEW_BN,
      timestamp: NEW_BN,
    },
  };
};

const initialState: Sun = getInitialState();

export default createReducer(initialState, (builder) =>
  builder
    .addCase(resetSun, () => getInitialState())
    .addCase(updateSeasonTime, (state, { payload }) => {
      state.seasonTime = payload;
    })
    .addCase(updateSeasonResult, (state, { payload }) => {
      state.season = payload;
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

// Selectors
const selectSelf = (state: { _beanstalk: { sun: Sun } }) =>
  state._beanstalk.sun;

export const selectCurrentSeason = createSelector(
  selectSelf,
  (state) => state.season.current
);

export const selectSunriseBlock = createSelector(selectSelf, (state) => ({
  block: state.season.sunriseBlock,
  timestamp: state.season.timestamp,
}));

export const selectAbovePeg = createSelector(
  selectSelf,
  (state) => state.season.abovePeg
);

export const selectRain = createSelector(selectSelf, (state) => ({
  rainStart: state.season.rainStart,
  raining: state.season.raining,
}));

export const selectSop = createSelector(selectSelf, (state) => ({
  lastSop: state.season.lastSop,
  lastSopSeason: state.season.lastSopSeason,
}));
