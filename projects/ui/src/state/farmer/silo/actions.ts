import { createAction } from '@reduxjs/toolkit';
import { AddressMap } from '~/constants';
import { FarmerSiloRewards, FarmerSiloBalance } from '.';

export type UpdateFarmerSiloBalancesPayload = AddressMap<
  Partial<FarmerSiloBalance>
>;

export const resetFarmerSilo = createAction('farmer/silo/reset');

export const updateFarmerMigrationStatus = createAction<boolean>(
  'farmer/silo/migration'
);

export const updateLegacyFarmerSiloRewards =
  createAction<FarmerSiloRewards>('farmer/silo/update');

export const updateLegacyFarmerSiloBalances =
  createAction<UpdateFarmerSiloBalancesPayload>(
    'farmer/silo/updateFarmerSiloBalances'
  );
