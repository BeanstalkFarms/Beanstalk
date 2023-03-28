import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { BeanstalkField } from '.';

export const resetBeanstalkField = createAction(
  'beanstalk/field/reset'
);

export const updateBeanstalkField = createAction<BeanstalkField>(
  'beanstalk/field/update'
);

export const updateHarvestableIndex = createAction<BigNumber>(
  'beanstalk/field/updateHarvestableIndex'
);
