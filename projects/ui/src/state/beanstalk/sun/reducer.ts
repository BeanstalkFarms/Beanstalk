import { createReducer, createSelector } from '@reduxjs/toolkit';
import { NEW_BN, ZERO_BN } from '~/constants';
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
  setMorningBlockMap,
  updateMorningBlock,
  setAwaitingMorningBlock,
  setMorning,
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
      timestamp: nextSunrise.minus({ hour: 1 }),
    },
    morning: {
      blockNumber: NEW_BN,
      blockMap: {},
      time: {
        awaiting: false,
        next: nextBlockUpdate,
        remaining: getDiffNow(nextBlockUpdate),
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
    .addCase(setMorning, (state, { payload }) => {
      const { blockNumber, blockMap } = payload;
      state.morning.blockMap = payload.blockMap;
      state.morning.blockNumber = payload.blockNumber;

      const key = blockNumber.toString();
      if (!(key in blockMap)) return;

      state.morning.time.next = blockMap[key].next;
      state.morning.time.remaining = getDiffNow(blockMap[key].next);
    })
    .addCase(updateMorningBlock, (state, { payload }) => {
      const map = { ...state.morning.blockMap };
      state.morning.blockNumber = payload;

      const key = payload.toString();
      if (!(key in map)) return;

      state.morning.time.next = map[key].next;
      state.morning.time.remaining = getDiffNow(map[key].next);
    })
    .addCase(setMorningBlockMap, (state, { payload }) => {
      state.morning.blockMap = payload;
    })
    .addCase(setAwaitingMorningBlock, (state, { payload }) => {
      state.morning.time.awaiting = payload;
    })
    .addCase(setRemainingUntilBlockUpdate, (state, { payload }) => {
      state.morning.time.remaining = payload;
    })
);

// ----- Selectors -----

const selectSelf = (state: { _beanstalk: { sun: Sun } }) =>
  state._beanstalk.sun;

/// we define selectSeasonState to allow proper memoization of derived selectors
const selectSeasonState = (state: {
  _beanstalk: { sun: { season: Sun['season'] } };
}) => state._beanstalk.sun.season;

export const selectCurrentSeason = createSelector(
  selectSeasonState,
  (seasonState) => seasonState.current
);

export const selectSunriseBlock = createSelector(
  selectSeasonState,
  ({ sunriseBlock, timestamp }) => ({
    block: sunriseBlock,
    timestamp,
  })
);

export const selectMorningBlock = createSelector(
  selectSelf,
  (state) => state.morning.blockNumber
);

export const selectMorning = createSelector(
  selectSeasonState,
  selectMorningBlock,
  (season, blockNumber) => {
    const sunriseBlock = season.sunriseBlock;
    const currentBlock = blockNumber;

    // interval range [1 to 25]
    const blockDiff = currentBlock.minus(sunriseBlock);
    const interval = blockDiff.plus(1);
    const isMorning = blockDiff.lt(25) && sunriseBlock.gt(0);
    const isMorningInterval = getIsMorningInterval(interval);

    return {
      blockNumber,
      isMorning: isMorning,
      interval: isMorningInterval ? interval : ZERO_BN,
    };
  }
);

export const selectMorningBlockTime = createSelector(
  selectSelf,
  (state) => state.morning.time
);

export const selectMorningBlockMap = createSelector(
  selectSelf,
  (state) => state.morning.blockMap
);
