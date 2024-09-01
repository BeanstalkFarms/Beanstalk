import { createReducer } from '@reduxjs/toolkit';
import { NEW_BN } from '~/constants';
import {
  getDiffNow,
  getNextExpectedBlockUpdate,
  getNextExpectedSunrise,
  Sun,
} from '.';
import {
  setNextSunrise,
  setRemainingUntilSunrise,
  setAwaitingSunrise,
  updateSeasonTime,
  resetSun,
  updateSeasonResult,
  setRemainingUntilBlockUpdate,
  setMorning,
  updateCurrentSeason,
} from './actions';

const getInitialState = () => {
  const nextSunrise = getNextExpectedSunrise();
  const nextBlockUpdate = getNextExpectedBlockUpdate();
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
      timestamp: nextSunrise.minus({ hour: 1 }),
    },
    morning: {
      isMorning: false,
      blockNumber: NEW_BN,
      index: NEW_BN,
    },
    morningTime: {
      awaiting: false,
      next: nextBlockUpdate,
      remaining: getDiffNow(nextBlockUpdate),
      endTime: nextSunrise.plus({ minutes: 5 }),
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
    .addCase(setRemainingUntilSunrise, (state, { payload }) => {
      state.sunrise.remaining = payload;
    })
    .addCase(setMorning, (state, { payload }) => {
      state.morning = payload.morning;
      state.morningTime = payload.morningTime;
    })
    .addCase(setRemainingUntilBlockUpdate, (state, { payload }) => {
      state.morningTime.remaining = payload;
    })
);
