import { createAction } from '@reduxjs/toolkit';
import { BeanPoolState } from '.';

export type UpdatePoolPayload = {
  address: string;
  pool: BeanPoolState;
};

export const updateBeanPool = createAction<UpdatePoolPayload>(
  'bean/pools/update'
);
export const updateBeanPools = createAction<UpdatePoolPayload[]>(
  'bean/pools/updateAll'
);
export const resetPools = createAction(
  'bean/pools/reset'
);
