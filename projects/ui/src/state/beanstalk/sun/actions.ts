import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { Sun } from '.';

export const updateSeason = createAction<BigNumber>(
  'beanstalk/sun/updateSeason'
);

export const updateSeasonTime = createAction<BigNumber>(
  'beanstalk/sun/updateSeasonTime'
);

export const setNextSunrise = createAction<Sun['sunrise']['next']>(
  'beanstalk/sun/setNextSunrise'
);

export const setAwaitingSunrise = createAction<Sun['sunrise']['awaiting']>(
  'beanstalk/sun/setAwaitingSunrise'
);

export const setRemainingUntilSunrise = createAction<Sun['sunrise']['remaining']>(
  'beanstalk/sun/setRemainingUntilSunrise'
);

export const resetSun = createAction(
  'beanstalk/sun/reset'
);
