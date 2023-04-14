import React from 'react';
import { Box, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';
import stalkIcon from '~/img/beanstalk/stalk-icon-winter.svg';
import seedIcon from '~/img/beanstalk/seed-icon-winter.svg';
import { NEW_BN } from '~/constants';
import { FarmerSiloRewards } from '~/state/farmer/silo';
import RewardItem from './RewardItem';
import { ClaimRewardsAction } from '../../lib/Beanstalk/Farm';
import { hoverMap } from '../../constants/silo';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

export type RewardsBarProps = {
  beans: FarmerSiloRewards['beans'];
  stalk: FarmerSiloRewards['stalk'];
  seeds: FarmerSiloRewards['seeds'];
  /// TEMP
  revitalizedStalk?: BigNumber;
  revitalizedSeeds?: BigNumber;
  /**
   * Either the selected or hovered action.
   * If present, grey out the non-included
   * rewards.
   */
  action?: ClaimRewardsAction | undefined;
  /**
   * Revitalized rewards are hidden if a wallet
   * does not have deposited unripe assets.
   */
  hideRevitalized?: boolean;
};

const RewardsBar: FC<RewardsBarProps & { compact?: boolean }> = (
  {
    beans,
    stalk,
    seeds,
    revitalizedStalk = NEW_BN,
    revitalizedSeeds = NEW_BN,
    action,
    hideRevitalized,
    compact = false,
  }) => {
  const GAP_LG = compact ? 2 : 3.5;
  const GAP_MD = compact ? 1 : 2;
  const GAP_XS = compact ? 0.5 : 1;

  const selectedActionIncludes = (c: ClaimRewardsAction) => action && hoverMap[action].includes(c);

  return (
    <Stack direction={{ lg: 'row', xs: 'column' }} columnGap={{ xs: GAP_XS, md: GAP_MD, lg: GAP_LG }} rowGap={1.5}>
      {/* Earned */}
      <Row gap={{ xs: GAP_XS, md: GAP_MD, lg: GAP_LG }}>
        <RewardItem
          title="Earned Beans"
          tooltip="The number of Beans earned since your last Plant. Upon Plant, Earned Beans are Deposited in the current Season."
          amount={beans.earned}
          icon={beanIcon}
          compact={compact}
          isClaimable={action && (action === ClaimRewardsAction.PLANT_AND_MOW || action === ClaimRewardsAction.CLAIM_ALL)}
        />
        <RewardItem
          title="Earned Stalk"
          tooltip="Stalk earned from Earned Beans. Earned Stalk automatically contribute to Stalk ownership and do not require any action to claim them."
          amount={stalk.earned}
          icon={stalkIcon}
          compact={compact}
          isClaimable={action && (action === ClaimRewardsAction.PLANT_AND_MOW || action === ClaimRewardsAction.CLAIM_ALL)}
        />
      </Row>
      <Box display={{ xs: 'block', lg: compact ? 'none' : 'block' }} sx={{ borderLeft: '0.5px solid', borderColor: 'divider' }} />
      {/* Grown */}
      <Row gap={{ xs: GAP_XS, md: GAP_MD, lg: GAP_LG }}>
        <RewardItem
          title="Plantable Seeds"
          tooltip="Seeds earned in conjunction with Earned Beans. Plantable Seeds must be Planted in order to grow Stalk."
          amount={seeds.earned}
          icon={seedIcon}
          compact={compact}
          isClaimable={selectedActionIncludes(ClaimRewardsAction.PLANT_AND_MOW)}
        />
        <RewardItem
          title="Grown Stalk"
          tooltip="Stalk earned from Seeds. Grown Stalk does not contribute to Stalk ownership until it is Mown. Grown Stalk is Mown at the beginning of any Silo interaction."
          amount={stalk.grown}
          icon={stalkIcon}
          compact={compact}
          isClaimable={selectedActionIncludes(ClaimRewardsAction.MOW)}
        />
      </Row>
      <Box display={{ xs: 'block', lg: compact ? 'none' : 'block' }} sx={{ borderLeft: '0.5px solid', borderColor: 'divider' }} />
      {/* Revitalized */}
      <Row gap={{ xs: GAP_XS, md: GAP_MD, lg: GAP_LG }}>
        <RewardItem
          title="Revitalized Stalk"
          tooltip="Stalk that have vested for pre-exploit Silo Members. Revitalized Stalk are minted as the percentage of Fertilizer sold increases. Revitalized Stalk does not contribute to Stalk ownership until Enrooted."
          amount={revitalizedStalk}
          icon={stalkIcon}
          compact={compact}
          isClaimable={hideRevitalized ? false : selectedActionIncludes(ClaimRewardsAction.ENROOT_AND_MOW)}
        />
        <RewardItem
          title="Revitalized Seeds"
          tooltip="Seeds that have vested for pre-exploit Silo Members. Revitalized Seeds are minted as the percentage of Fertilizer sold increases. Revitalized Seeds do not generate Stalk until Enrooted."
          amount={revitalizedSeeds}
          icon={seedIcon}
          compact={compact}
          isClaimable={hideRevitalized ? false : selectedActionIncludes(ClaimRewardsAction.ENROOT_AND_MOW)}
        />
      </Row>
    </Stack>
  );
};

export default RewardsBar;
