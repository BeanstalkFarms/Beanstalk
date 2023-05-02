import { createAction } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';
import { FarmerDelegation } from '.';
import { GovSpace } from '~/lib/Beanstalk/Governance';

export const setFarmerDelegators = createAction<FarmerDelegation['delegators']>(
  'farmer/delegations/setFarmerDelegators'
);

export const setFarmerDelegates = createAction<FarmerDelegation['delegates']>(
  'farmer/delegations/setFarmerDelegates'
);

export const setDelegatorsVotingPower = createAction<{
  space: GovSpace;
  votingPower: BigNumber;
}>('farmer/delegations/setDelegatorsStalkVotingPower');
