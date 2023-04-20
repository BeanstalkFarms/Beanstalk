import { createAction } from '@reduxjs/toolkit';
import { FarmerField } from '.';

export const resetFarmerField = createAction(
  'farmer/field/reset'
);
export const updateFarmerField = createAction<FarmerField>(
  'farmer/field/update'
);
