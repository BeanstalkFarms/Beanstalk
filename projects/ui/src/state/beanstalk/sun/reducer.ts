import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import { getNextMorningIntervalUpdate, getNextExpectedSunrise, Sun } from '.';
import {
  setNextSunrise,
  setAwaitingSunrise,
  updateSeasonTime,
  resetSun,
  updateSeasonResult,
  setMorning,
  updateCurrentSeason,
} from './actions';

const getInitialState = () => {
  const nextSunrise = getNextExpectedSunrise();
  const nextMorningIntervalUpdate = getNextMorningIntervalUpdate();
  return {
    seasonTime: NEW_BN,
    sunrise: {
      awaiting: false,
      next: nextSunrise,
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
      timestamp: nextSunrise.minus({ hour: 1 }),
    },
    morning: {
      isMorning: false,
      blockNumber: NEW_BN,
      index: NEW_BN,
      next: nextMorningIntervalUpdate,
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
    .addCase(updateCurrentSeason, (state, { payload }) => {
      state.season.current = payload;
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
    .addCase(setMorning, (state, { payload }) => {
      state.morning = payload;
    })
);
