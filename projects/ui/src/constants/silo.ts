import { ClaimRewardsAction } from '../lib/Beanstalk/Farm';

export const hoverMap = {
  [ClaimRewardsAction.MOW]:             [ClaimRewardsAction.MOW],
  [ClaimRewardsAction.PLANT_AND_MOW]:   [ClaimRewardsAction.MOW, ClaimRewardsAction.PLANT_AND_MOW],
  [ClaimRewardsAction.ENROOT_AND_MOW]:  [ClaimRewardsAction.MOW, ClaimRewardsAction.ENROOT_AND_MOW],
  // [ClaimRewardsAction.ENROOT_AND_MOW]:  [ClaimRewardsAction.MOW, ClaimRewardsAction.PLANT_AND_MOW, ClaimRewardsAction.ENROOT_AND_MOW, ClaimRewardsAction.CLAIM_ALL],
  [ClaimRewardsAction.CLAIM_ALL]:       [ClaimRewardsAction.MOW, ClaimRewardsAction.PLANT_AND_MOW, ClaimRewardsAction.ENROOT_AND_MOW, ClaimRewardsAction.CLAIM_ALL],
};
