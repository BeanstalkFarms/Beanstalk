import { useCallback, useMemo } from 'react';
import { FarmToMode, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import useSdk, { getNewToOldToken } from '../../sdk';

import useFarmerFertilizer from '../useFarmerFertilizer';
import useFarmerField from '../useFarmerField';
import useFarmerSilo from '../useFarmerSilo';
import useRevitalized from '../useRevitalized';
import { normalizeBN } from '~/util';
import ClaimPlant, { ClaimPlantAction } from '~/util/ClaimPlant';
import { Action, ActionType } from '~/util/Actions';

const tooltips = {
  mow: 'Add Grown Stalk to your Stalk balance. Mow is called upon any interaction with the Silo.',
  plant:
    'Add Plantable Seeds to your Seed balance. Also Mows Grown Stalk, Deposits Earned Beans and claims Earned Stalk.',
  enroot:
    'Add Revitalized Stalk and Seeds to your Stalk and Seed balances, respectively. Also Mows Grown Stalk.',
  harvest: 'Redeem debt paid back by Beanstalk for 1 Bean',
  rinse: 'Redeem debt paid back by Beanstalk for purchasing fertilizer',
  claim: 'Claim Beans that have been withdrawn from the silo',
  grownStalk:
    'Stalk earned from Seeds. Grown Stalk does not contribute to Stalk ownership until it is Mown. Grown Stalk is Mown at the beginning of any Silo interaction.',
  earnedBeans:
    'The number of Beans earned since your last Plant. Upon Plant, Earned Beans are Deposited in the current Season.',
  earnedStalk:
    'Stalk earned from Earned Beans. Earned Stalk automatically contribute to Stalk ownership and do not require any action to claim them.',
  earnedSeeds:
    'Seeds earned in conjunction with Earned Beans. Plantable Seeds must be Planted in order to grow Stalk.',
  harvestablePods:
    'The number of Pods that have become redeemable for 1 Bean (i.e., the debt paid back by Beanstalk)',
  rinsableSprouts:
    'Sprouts that are redeemable for 1 Bean each. Rinsable Sprouts must be Rinsed in order to use them.',
  claimableBeans:
    'Beans that have been withdrawn from the silo and are ready to be claimed.',
  revitalizedSeeds:
    'Seeds that have vested for pre-exploit Silo Members. Revitalized Seeds are minted as the percentage of Fertilizer sold increases. Revitalized Seeds do not generate Stalk until Enrooted.',
  revitalizedStalk:
    'Stalk that have vested for pre-exploit Silo Members. Revitalized Stalk are minted as the percentage of Fertilizer sold increases. Revitalized Stalk does not contribute to Stalk ownership until Enrooted.',
};

type TXActionParams = {
  [ClaimPlantAction.MOW]: never;
  [ClaimPlantAction.PLANT]: never;
  [ClaimPlantAction.ENROOT]: never;
  [ClaimPlantAction.HARVEST]: { toMode?: FarmToMode };
  [ClaimPlantAction.RINSE]: { toMode?: FarmToMode };
  [ClaimPlantAction.CLAIM]: { toMode?: FarmToMode };
};

type ClaimableOption = {
  /**
   * Amount of beans claimable
   */
  amount: BigNumber;
  /**
   * Token which will be used to redeem the claimable beans
   */
  token: Token;
};

type ClaimPlantOptionSummary = {
  /**
   *
   */
  description: string;
  /**
   * Token corresponding to the amount */
  token: Token;
  /**
   * Amount of the token being claimed / planted */
  amount: BigNumber;
  /**
   *
   */
  tooltip: string;
};

export type ClaimPlantItem = {
  /**
   *
   */
  title: string;
  /**
   *
   */
  tooltip: string;
  /**
   * Whether or not this claim / plant action can be performed
   */
  enabled: boolean;
  /**
   * implied actions of a Claim/Plant Action that are performed automatically in the contract
   */
  implied: ClaimPlantAction[];
  /**
   * A summary of the assets an action intends to claim / plant.
   */
  summary: ClaimPlantOptionSummary[];
  /**
   * If the action claims BEANS, the the token used to redeem, and amount of beans claimable
   * This is only applicable to CLAIM actions (CLAIM, HARVEST, RINSE)
   */
  claimable?: ClaimableOption;
  /**
   *
   */
  txActions: (...params: TXActionParams[ClaimPlantAction][]) => Action[];
};

export type ClaimPlantItems = {
  [action in ClaimPlantAction]: ClaimPlantItem;
};

const isClaimingBeansAction = (action: ClaimPlantAction) => {
  const isClaiming =
    action === ClaimPlantAction.CLAIM ||
    action === ClaimPlantAction.HARVEST ||
    action === ClaimPlantAction.RINSE;

  return isClaiming;
};

export default function useFarmerClaimAndPlantOptions() {
  ///
  const sdk = useSdk();

  /// Farmer
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();
  const { revitalizedStalk, revitalizedSeeds } = useRevitalized();

  const options: ClaimPlantItems = useMemo(() => {
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
        tooltip: tooltips.mow,
        enabled: grownStalk.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.MOW] || [],
        summary: [
          {
            description: 'Grown Stalk',
            tooltip: 'tooltip',
            token: STALK,
            amount: grownStalk,
          },
        ],
        txActions: () => [
          {
            type: ActionType.MOW,
            stalk: grownStalk,
          },
        ],
      },
      [ClaimPlantAction.PLANT]: {
        title: 'Plant',
        tooltip: tooltips.plant,
        enabled: earnedSeeds.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.PLANT] || [],
        summary: [
          {
            description: 'Earned Beans',
            tooltip: tooltips.earnedBeans,
            token: BEAN,
            amount: earnedBeans,
          },
          {
            description: 'Earned Stalk',
            tooltip: tooltips.earnedStalk,

            token: STALK,
            amount: earnedStalk,
          },
          {
            description: 'Earned Seeds',
            tooltip: tooltips.earnedSeeds,
            token: SEEDS,
            amount: earnedSeeds,
          },
        ],
        txActions: () => [
          {
            type: ActionType.PLANT,
            bean: earnedBeans,
            stalk: earnedStalk,
            seeds: earnedSeeds,
          },
        ],
      },
      [ClaimPlantAction.ENROOT]: {
        title: 'Enroot',
        tooltip: tooltips.enroot,
        enabled: revitalizedSeeds.gt(0) && revitalizedStalk.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.ENROOT] || [],
        summary: [
          {
            description: 'Revitalized Seeds',
            tooltip: tooltips.revitalizedSeeds,
            token: SEEDS,
            amount: revitalizedSeeds,
          },
          {
            description: 'Revitalized Stalk',
            tooltip: tooltips.revitalizedStalk,
            token: STALK,
            amount: revitalizedStalk,
          },
        ],
        txActions: () => [
          {
            type: ActionType.ENROOT,
            seeds: revitalizedSeeds,
            stalk: revitalizedStalk,
          },
        ],
      },
      [ClaimPlantAction.HARVEST]: {
        title: 'Harvest',
        tooltip: tooltips.harvest,
        enabled: harvestablePods.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.HARVEST] || [],
        claimable: {
          token: PODS,
          amount: harvestablePods,
        },
        summary: [
          {
            description: 'Harvestable Pods',
            tooltip: tooltips.harvestablePods,
            token: PODS,
            amount: harvestablePods,
          },
        ],
        txActions: () => [
          {
            type: ActionType.HARVEST,
            amount: harvestablePods,
          },
        ],
      },
      [ClaimPlantAction.RINSE]: {
        title: 'Rinse',
        tooltip: tooltips.rinse,
        enabled: rinsableSprouts.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.RINSE] || [],
        claimable: {
          token: SPROUTS,
          amount: rinsableSprouts,
        },
        summary: [
          {
            description: 'Rinsable Sprouts',
            tooltip: tooltips.rinsableSprouts,
            token: SPROUTS,
            amount: rinsableSprouts,
          },
        ],
        txActions: () => [
          {
            type: ActionType.RINSE,
            amount: rinsableSprouts,
          },
        ],
      },
      [ClaimPlantAction.CLAIM]: {
        title: 'Claim',
        tooltip: tooltips.claim,
        enabled: claimableBeans.gt(0),
        implied: ClaimPlant.config.implied[ClaimPlantAction.CLAIM] || [],
        claimable: {
          token: BEAN,
          amount: claimableBeans,
        },
        summary: [
          {
            description: 'Claimable Beans',
            tooltip: tooltips.claimableBeans,
            token: BEAN,
            amount: claimableBeans,
          },
        ],
        txActions: () => [
          {
            type: ActionType.CLAIM_WITHDRAWAL,
            amount: claimableBeans,
            token: getNewToOldToken(BEAN),
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

  const getPlantableAmount = useCallback(() => {
    
  }, []);

  /**
   * Returns the total amount of beans claimable from a list of claimable actions
   */
  const getClaimable = useCallback(
    (_options?: ClaimPlantAction[]) => {
      const amount = _options?.reduce((prev, curr) => {
        const option = options[curr] as ClaimPlantItem;
        prev = prev.plus(normalizeBN(option?.claimable?.amount));
        return prev;
      }, ZERO_BN);

      const tokenValue = sdk.tokens.BEAN.fromHuman(amount?.toString() || '0');

      return {
        bn: amount || ZERO_BN,
        tokenValue,
      };
    },
    [options, sdk.tokens.BEAN]
  );

  const getTxnActions = useCallback(
    (
      _primary: ClaimPlantAction[] | undefined,
      _secondary: ClaimPlantAction[] | undefined,
      graphicOnClaimBeans?: boolean
    ) => {
      const primary = _primary || [];
      const secondary = _secondary || [];

      const postStartIndex = primary.length;
      const actions = [...primary, ...secondary].reduce<{
        pre: Action[];
        post: Action[];
        claiming: Action[];
      }>(
        (prev, curr, idx) => {
          const option = options[curr];
          let _actions;
          if (isClaimingBeansAction(curr)) {
            _actions = option.txActions();
            if (graphicOnClaimBeans) {
              prev.claiming = [...prev.claiming, ..._actions];
            }
          } else {
            _actions = option.txActions();
          }
          if (idx >= postStartIndex) {
            prev.post = [...prev.post, ..._actions];
          } else {
            prev.pre = [...prev.pre, ..._actions];
          }
          return prev;
        },
        { pre: [], post: [], claiming: [] }
      );

      return {
        preActions: actions.pre,
        postActions: actions.post,
        preActionsWithGraphic: actions.claiming,
      };
    },
    [options]
  );

  return { options, getClaimable, getTxnActions };
}
