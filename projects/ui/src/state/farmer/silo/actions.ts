import { createAction } from '@reduxjs/toolkit';
import { Token, TokenSiloBalance } from '@beanstalk/sdk';
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
    'farmer/silo/updateLegacyFarmerSiloBalances'
  );

export const updateFarmerSiloBalances = createAction<
  Map<Token, TokenSiloBalance>
>('farmer/silo/updateFarmerSiloBalances');
