import { useCallback, useMemo } from 'react';
import { Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import useSdk from '../sdk';

import useFarmerFertilizer from './useFarmerFertilizer';
import useFarmerField from './useFarmerField';
import useFarmerSilo from './useFarmerSilo';
import useRevitalized from './useRevitalized';
import { normalizeBN } from '~/util';
import { ClaimPlantAction } from '~/util/ClaimPlant';

export type ClaimPlantActionSummary = {
  /** */
  title: string;
  /** */
  tooltip: string;
  /**
   * Whether or not this claim / plant action can be performed
   */
  enabled: boolean;
  /**
   * actions that are performed automatically when this action is performed in the contract
   */
  implied: ClaimPlantAction[],
  /**
   * The amounts of BEAN, SEEDS, and STALK being claimed / planted.
   * For Example, for Enroot, this would be the amount of revitalized seeds and stalk
   * the key is the UI title of the token being claimed / planted
   */
  summary: {
    /**
     *
     */
    description: string;
    /**
     * Token corresponding to the amount
     */
    token: Token;
    /**
     * amount of the token being claimed / planted
     */
    amount: BigNumber;
    /**
     * 
     */
    tooltip: string;
  }[];
  /**
   * The amount of beans that can be used upon performing claim / plant action
   * This is only applicable to CLAIM actions (CLAIM, HARVEST, RINSE)
   */
  claimable?: {
    /**
     * amount of beans claimable
     */
    amount: BigNumber;
    /**
     * token which will be used to redeem the claimable beans
     */
    token: Token;
  };
};

export type ClaimPlantOptionsMap = {
  [action in ClaimPlantAction]: ClaimPlantActionSummary;
}

/**
 * Returns an object mapping ClaimPlantAction to
 * - enabled: whether or not the action can be performed
 * - amounts: the amounts of BEAN, SEEDS, and STALK being claimed / planted
 * - claimable?: the amount of beans that can be used upon performing claim / plant action
 */
export default function useFarmerClaimAndPlantOptions() {
  /// 
  const sdk = useSdk();

  /// Farmer
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();
  const { revitalizedStalk, revitalizedSeeds } = useRevitalized();

  const options: ClaimPlantOptionsMap = useMemo(() => {
    const { SEEDS, STALK, BEAN, PODS, SPROUTS } = sdk.tokens;

    const grownStalk = normalizeBN(farmerSilo.stalk.grown);
  
    const earnedBeans = normalizeBN(farmerSilo.beans.earned);
    const earnedStalk = normalizeBN(farmerSilo.stalk.earned);
    const earnedSeeds = normalizeBN(farmerSilo.seeds.earned);

    const harvestablePods = normalizeBN(farmerField.harvestablePods);
    const rinsableSprouts = normalizeBN(farmerBarn.fertilizedSprouts);
    const claimableBeans = normalizeBN(
      farmerSilo.balances[BEAN.address]?.claimable.amount
    );

    return {
      [ClaimPlantAction.MOW]: {
        title: 'Mow',
        tooltip: 'tooltip',
        enabled: grownStalk.gt(0),
        implied: [],
        summary: [
          {
            description: 'Grown Stalk',
            tooltip: 'tooltip',
            token: BEAN,
            amount: grownStalk,
          },
        ],
      },
      [ClaimPlantAction.PLANT]: {
        title: 'Plant',
        tooltip: 'tooltip',
        enabled: earnedSeeds.gt(0),
        implied: [ClaimPlantAction.MOW],
        summary: [
          {
            description: 'Earned Beans',
            tooltip: 'tooltip',
            token: BEAN,
            amount: earnedBeans,
          },
          {
            description: 'Earned Stalk',
            tooltip: 'tooltip',
            token: STALK,
            amount: earnedStalk,
          },
          {
            description: 'Earned Seeds',
            tooltip: 'tooltip',
            token: SEEDS,
            amount: earnedSeeds,
          },
        ],
      },
      [ClaimPlantAction.ENROOT]: {
        title: 'Enroot',
        tooltip: 'tooltip',
        enabled: revitalizedSeeds.gt(0) && revitalizedStalk.gt(0),
        implied: [ClaimPlantAction.MOW],
        summary: [
          {
            description: 'Revitalized Seeds',
            tooltip: 'tooltip',
            token: SEEDS,
            amount: revitalizedSeeds,
          },
          {
            description: 'Revitalized Stalk',
            tooltip: 'tooltip',
            token: STALK,
            amount: revitalizedStalk,
          },
        ],
      },
      [ClaimPlantAction.HARVEST]: {
        title: 'Harvest',
        tooltip: 'tooltip',
        enabled: harvestablePods.gt(0),
        implied: [],
        claimable: {
          token: PODS,
          amount: harvestablePods,
        },
        summary: [
          {
            description: 'Harvestable Pods',
            tooltip: 'tooltip',
            token: sdk.tokens.PODS,
            amount: harvestablePods,
          },
        ],
      },
      [ClaimPlantAction.RINSE]: {
        title: 'Rinse',
        tooltip: 'tooltip',
        enabled: rinsableSprouts.gt(0),
        implied: [],
        claimable: {
          token: SPROUTS,
          amount: rinsableSprouts,
        },
        summary: [
          {
            description: 'Rinsable Sprouts',
            tooltip: 'tooltip',
            token: sdk.tokens.SPROUTS,
            amount: rinsableSprouts,
          },
        ],
      },
      [ClaimPlantAction.CLAIM]: {
        title: 'Claim',
        tooltip: 'tooltip',
        enabled: claimableBeans.gt(0),
        implied: [ClaimPlantAction.MOW],
        claimable: {
          token: BEAN,
          amount: claimableBeans,
        },
        summary: [
          {
            description: 'Claimable Beans',
            tooltip: 'tooltip',
            token: BEAN,
            amount: claimableBeans,
          },
        ],
      },
    };
  }, [
    farmerBarn.fertilizedSprouts,
    farmerField.harvestablePods,
    farmerSilo.balances,
    farmerSilo.beans.earned,
    farmerSilo.seeds.earned,
    farmerSilo.stalk.earned,
    farmerSilo.stalk.grown,
    revitalizedSeeds,
    revitalizedStalk,
    sdk.tokens,
  ]);

  const getClaimable = useCallback((_options: ClaimPlantAction[] = []) => {
    const amount = _options.reduce((prev, curr) => {
      prev = prev.plus(normalizeBN(options[curr]?.claimable?.amount));
      return prev;
    }, ZERO_BN);

    const tokenValue = sdk.tokens.BEAN.amount(amount.toString());

    return {
      bn: amount,
      tokenValue,
    };
  }, [options, sdk.tokens.BEAN]);

  return { options, getClaimable };
}
