import { createAction } from '@reduxjs/toolkit';
import { BeanstalkBarn } from '.';

export const resetBarn = createAction(
  'beanstalk/barn/reset'
);

export const updateBarn = createAction<BeanstalkBarn>(
  'beanstalk/barn/update'
);
