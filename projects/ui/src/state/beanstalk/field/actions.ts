import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { BeanstalkField } from '.';

export const resetBeanstalkField = createAction('beanstalk/field/reset');

export const updateBeanstalkField = createAction<
  Omit<BeanstalkField, 'temperatures'>
>('beanstalk/field/update');

export const updateHarvestableIndex = createAction<BigNumber>(
  'beanstalk/field/updateHarvestableIndex'
);

export const updateScaledTemperature = createAction<BigNumber>(
  'beanstalk/field/updateScaledTemperature'
);

export const updateMaxTemperature = createAction<BigNumber>(
  'beanstalk/field/updateMaxTemperature'
);

export const updateTotalSoil = createAction<BigNumber>(
  'beanstalk/field/updateTotalSoil'
);

export const setMorningTemperatureMap = createAction<
  BeanstalkField['temperatures']
>('beanstalk/field/setMorningTemperatureMap');

export const updateTemperatureByBlock = createAction<
  BeanstalkField['temperatures'][string]
>('beanstalk/field/updateTemperatureMapByBlock');
