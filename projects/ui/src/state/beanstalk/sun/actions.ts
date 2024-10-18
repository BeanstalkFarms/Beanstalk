import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { Duration } from 'luxon';
import { Morning, Sun } from '.';

export const updateSeasonTime = createAction<BigNumber>(
  'beanstalk/sun/updateSeasonTime'
);

export const updateSeasonResult = createAction<Sun['season']>(
  'beanstalk/sun/updateSunSeason'
);

export const updateCurrentSeason = createAction<Sun['season']['current']>(
  'beanstalk/sun/updateSunCurrentSeason'
);

export const setNextSunrise = createAction<Sun['sunrise']['next']>(
  'beanstalk/sun/setNextSunrise'
);

export const setAwaitingSunrise = createAction<Sun['sunrise']['awaiting']>(
  'beanstalk/sun/setAwaitingSunrise'
);

export const resetSun = createAction('beanstalk/sun/reset');

/// morning

export const setMorning = createAction<Morning>('beanstalk/sun/setMorning');

export const updateMorningBlock = createAction<Sun['morning']['blockNumber']>(
  'beanstalk/sun/updateMorningBlock'
);

export const setRemainingUntilBlockUpdate = createAction<Duration>(
  'beanstalk/sun/setRemainingUntilBlockUpdate'
);

export const setAwaitingMorningBlock = createAction<boolean>(
  'beanstalk/sun/setAwaitingMorningBlock'
);
