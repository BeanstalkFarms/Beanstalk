import { createAction } from '@reduxjs/toolkit';
import { FarmerBarn } from '.';

export const updateFarmerBarn = createAction<FarmerBarn>(
  'farmer/barn/updateBarn'
);

export const resetFarmerBarn = createAction('farmer/barn/reset');
