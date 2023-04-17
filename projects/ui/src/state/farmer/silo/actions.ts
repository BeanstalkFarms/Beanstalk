import { createAction } from '@reduxjs/toolkit';
import { AddressMap } from '~/constants';
import { FarmerSiloRewards, FarmerSiloBalance } from '.';

export type UpdateFarmerSiloBalancesPayload = AddressMap<Partial<FarmerSiloBalance>>

export const resetFarmerSilo = createAction(
  'farmer/silo/reset'
);

export const updateFarmerSiloRewards = createAction<FarmerSiloRewards>(
  'farmer/silo/update'
);

export const updateFarmerSiloBalances = createAction<UpdateFarmerSiloBalancesPayload>(
  'farmer/silo/updateFarmerSiloBalances'
);
