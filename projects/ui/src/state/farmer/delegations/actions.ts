import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { FarmerDelegation } from '.';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import { AddressMap } from '~/constants';

export const setFarmerDelegators = createAction<
  FarmerDelegation['delegators']['users']
>('farmer/delegations/setFarmerDelegators');

export const setFarmerDelegates = createAction<FarmerDelegation['delegates']>(
  'farmer/delegations/setFarmerDelegates'
);

export const setDelegatorsVotingPower = createAction<{
  space: GovSpace;
  data: AddressMap<BigNumber>;
}>('farmer/delegations/setDelegatorsVotingPower');
