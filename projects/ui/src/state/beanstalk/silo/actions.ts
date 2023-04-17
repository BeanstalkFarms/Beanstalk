import { createAction } from '@reduxjs/toolkit';
import { BeanstalkSilo } from '.';

export const resetBeanstalkSilo = createAction(
  'beanstalk/silo/reset'
);

export const updateBeanstalkSilo = createAction<BeanstalkSilo>(
  'beanstalk/silo/update'
);
