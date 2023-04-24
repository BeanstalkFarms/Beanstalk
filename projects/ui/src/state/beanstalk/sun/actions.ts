import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
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

export const updateMorningBlock = createAction<Sun['morning']['block']>(
  'beanstalk/sun/updateMorningBlock'
);

export const updateMorningTimestamp = createAction<
  Sun['morning']['block']['timestamp']
>('beanstalk/sun/updateMorningTimestamp');

export const setRemainingUntilBlockUpdate = createAction<
  Sun['morning']['time']['remaining']
>('beanstalk/sun/setRemainingUntilBlockUpdate');

export const setNextBlockUpdate = createAction<Sun['morning']['time']['next']>(
  'beanstalk/sun/setNextBlockUpdate'
);
