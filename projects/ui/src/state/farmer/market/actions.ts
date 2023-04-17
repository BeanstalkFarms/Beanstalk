import { createAction } from '@reduxjs/toolkit';
import { FarmerMarket } from '.';

export const resetFarmerMarket = createAction(
  'farmer/market/reset'
);
export const updateFarmerMarket = createAction<FarmerMarket>(
  'farmer/market/update'
);
