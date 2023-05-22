import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { Duration } from 'luxon';
import { Sun } from '.';

export const updateSeasonTime = createAction<BigNumber>(
  'beanstalk/sun/updateSeasonTime'
);

export const updateSeasonResult = createAction<Sun['season']>(
  'beanstalk/sun/updateSunSeason'
);

export const setNextSunrise = createAction<Sun['sunrise']['next']>(
  'beanstalk/sun/setNextSunrise'
);

export const setAwaitingSunrise = createAction<Sun['sunrise']['awaiting']>(
  'beanstalk/sun/setAwaitingSunrise'
);

export const setRemainingUntilSunrise = createAction<
  Sun['sunrise']['remaining']
>('beanstalk/sun/setRemainingUntilSunrise');

export const resetSun = createAction('beanstalk/sun/reset');

/// morning
export const updateMorningBlock = createAction<BigNumber>(
  'beanstalk/sun/updateMorningBlock'
);

export const setMorningBlockMap = createAction<Sun['morning']['blockMap']>(
  'beanstalk/sun/setMorningBlockMap'
);

export const setRemainingUntilBlockUpdate = createAction<Duration>(
  'beanstalk/sun/setRemainingUntilBlockUpdate'
);

export const setAwaitingMorningBlock = createAction<boolean>(
  'beanstalk/sun/setAwaitingMorningBlock'
);

export const setMorning = createAction<Omit<Sun['morning'], 'time'>>(
  'beanstalk/sun/setMorning'
);
