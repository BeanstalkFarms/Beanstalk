import { createReducer, createSelector } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { NEW_BN, ZERO_BN } from '~/constants';
import {
  getDiffNow,
  getNextExpectedBlockUpdate,
  getNextExpectedSunrise,
  getNowRounded,
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
  setAwaitingMorningBlock,
  setMorning,
  setNextBlockUpdate,
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
    .addCase(setAwaitingMorningBlock, (state, { payload }) => {
      state.morningTime.awaiting = payload;
    })
    .addCase(setRemainingUntilBlockUpdate, (state, { payload }) => {
      state.morningTime.remaining = payload;
    })
    .addCase(setNextBlockUpdate, (state, { payload }) => {
      state.morningTime.next = payload;
    })
);

// ----- Selectors -----

const selectSelf = (state: { _beanstalk: { sun: Sun } }) =>
  state._beanstalk.sun;

/// we define selectSeasonState to allow proper memoization of derived selectors
const selectSeasonState = (state: {
  _beanstalk: { sun: { season: Sun['season'] } };
}) => state._beanstalk.sun.season;

/// we define selectMorningState to allow proper memoization of derived selectors
const selectMorningState = (state: {
  _beanstalk: { sun: { morning: Sun['morning'] } };
}) => state._beanstalk.sun.morning;

export const selectCurrentSeason = createSelector(
  selectSeasonState,
  (seasonState) => seasonState.current
);

export const selectSunriseBlock = createSelector(
  selectSeasonState,
  ({ sunriseBlock, timestamp }) => ({
    blockNumber: sunriseBlock,
    timestamp,
  })
);

export const selectMorning = createSelector(
  selectSeasonState,
  selectMorningState,
  (season, { blockNumber }) => {
    const sunriseBlock = season.sunriseBlock;
    const sunrisetime = season.timestamp;
    const currentBlock = blockNumber;

    const endTime = sunrisetime.plus({ minutes: 5 });

    const nowSecs = getNowRounded().toSeconds();
    const sunriseSecs = sunrisetime.toSeconds();
    const isMorning = nowSecs >= sunriseSecs && nowSecs < endTime.toSeconds();

    const maxSeconds = endTime.toSeconds() - sunriseSecs;
    const currentSeconds = nowSecs - sunriseSecs;

    // console.log('maxSeconds: ', maxSeconds.toString());
    // console.log('currentSeconds: ', currentSeconds.toString());

    const secondsDiff = new BigNumber(maxSeconds).minus(currentSeconds);
    // console.log('secondsDiff: ', secondsDiff.toString());

    // interval range [1 to 25]
    const blockDiff = currentBlock.minus(sunriseBlock);
    const interval = blockDiff.plus(1);
    const isMorningInterval = getIsMorningInterval(interval);

    return {
      blockNumber,
      isMorning: isMorning,
      interval: isMorningInterval ? interval : ZERO_BN,
    };
  }
);

export const selectMorningTime = createSelector(
  selectSelf,
  (state) => state.morningTime
);

// export const selectMorningBlockMap = createSelector(
//   selectMorningState,
//   (state) => state.blockMap
// );
