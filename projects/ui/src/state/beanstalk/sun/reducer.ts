import { createReducer, createSelector } from '@reduxjs/toolkit';
import { DateTime } from 'luxon';
import { NEW_BN, ZERO_BN } from '~/constants';
import {
  getNextExpectedBlockUpdate,
  getNextExpectedSunrise,
  MorningData,
  Sun,
} from '.';
import {
  setNextSunrise,
  setRemainingUntilSunrise,
  setAwaitingSunrise,
  updateSeasonTime,
  resetSun,
  updateSeasonResult,
  updateMorningTimestamp,
  updateMorningBlock,
} from './actions';
import { getIsMorningInterval } from './morning';

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
      timestamp: DateTime.now(),
    },
    morning: {
      block: {
        blockNumber: NEW_BN,
        timestamp: DateTime.now(),
      },
      time: {
        next: nextBlockUpdate,
        remaining: nextBlockUpdate.diffNow(),
      },
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
    .addCase(updateMorningBlock, (state, { payload }) => {
      state.morning.block = payload;
    })
    .addCase(updateMorningTimestamp, (state, { payload }) => {
      state.morning.block.timestamp = payload;
    })
);

// ----- Selectors -----

const selectSelf = (state: { _beanstalk: { sun: Sun } }) =>
  state._beanstalk.sun;

const selectSeasonState = (state: {
  _beanstalk: { sun: { season: Sun['season'] } };
}) => state._beanstalk.sun.season;

// ----- exported -----

export const selectCurrentSeason = createSelector(
  selectSeasonState,
  (state) => state.current
);

export const selectSunriseBlock = createSelector(
  selectSeasonState,
  ({ sunriseBlock, timestamp }) => ({
    block: sunriseBlock,
    timestamp,
  })
);

export const selectAbovePeg = createSelector(
  selectSeasonState,
  (state) => state.abovePeg
);

const selectMorningBlock = (state: {
  _beanstalk: { sun: { morning: { block: Sun['morning']['block'] } } };
}) => state._beanstalk.sun.morning.block;

export const selectMorning = createSelector(
  selectSeasonState,
  selectMorningBlock,
  (season, morning) => {
    const sunriseBlock = season.sunriseBlock;
    const currentBlock = morning.blockNumber;

    // interval range [1 to 25]
    const blockDiff = currentBlock.minus(sunriseBlock);
    const interval = blockDiff.plus(1);
    const isMorning = blockDiff.lt(25);
    const isMorningInterval = getIsMorningInterval(interval);

    return {
      blockNumber: currentBlock,
      timestamp: morning.timestamp,
      isMorning: isMorning,
      interval: isMorningInterval ? interval : ZERO_BN,
    } as MorningData;
  }
);

export const selectMorningBlockUpdate = createSelector(
  selectSelf,
  (state) => state.morning.time
);
