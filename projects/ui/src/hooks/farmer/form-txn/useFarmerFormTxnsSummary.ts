import { useCallback, useMemo } from 'react';
import { FarmToMode, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { useFormikContext } from 'formik';
import { ZERO_BN } from '~/constants';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';

import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useRevitalized from '~/hooks/farmer/useRevitalized';
import { normalizeBN } from '~/util';
import { Action, ActionType } from '~/util/Actions';
import { FormTxn } from '~/lib/Txn';

const tooltips = {
  mow: 'Add Grown Stalk to your Stalk balance. Mow is called upon any interaction with the Silo.',
  plant:
    'Add Plantable Seeds to your Seed balance. Also Mows Grown Stalk, Deposits Earned Beans and claims Earned Stalk.',
  enroot:
    'Add Revitalized Stalk and Seeds to your Stalk and Seed balances, respectively. Also Mows Grown Stalk.',
  harvest: 'Redeem debt paid back by Beanstalk for 1 Bean.',
  rinse: 'Redeem debt paid back by Beanstalk for purchasing Fertilizer.',
  claim: 'Claim Beans that have been withdrawn from the Silo.',
  grownStalk:
    'Stalk earned from Seeds. Grown Stalk does not contribute to Stalk ownership until it is Mown. Grown Stalk for a particular whitelisted asset is Mown at the beginning of any Silo interaction.',
  earnedBeans:
    'The number of Beans earned since your last Plant. Upon Plant, Earned Beans are Deposited in the current Season.',
  earnedStalk:
    'Stalk earned from Earned Beans. Earned Stalk automatically contribute to Stalk ownership even before claiming.',
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
  [FormTxn.MOW]: never;
  [FormTxn.PLANT]: never;
  [FormTxn.ENROOT]: never;
  [FormTxn.HARVEST]: { toMode?: FarmToMode };
  [FormTxn.RINSE]: { toMode?: FarmToMode };
  [FormTxn.CLAIM]: { toMode?: FarmToMode };
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

export type FormTxnOptionSummary = {
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

export type FormTxnSummary = {
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
   * A summary of the assets an action intends to claim / plant.
   */
  summary: FormTxnOptionSummary[];
  /**
   * If the action claims BEANS, the the token used to redeem, and amount of beans claimable
   * This is only applicable to CLAIM actions (CLAIM, HARVEST, RINSE)
   */
  claimable?: ClaimableOption;
  /**
   *
   */
  txActions: (...params: TXActionParams[FormTxn][]) => Action[];
};

export type FormTxnSummaryMap = {
  [action in FormTxn]: FormTxnSummary;
};

export default function useFarmerFormTxnsSummary(mode?: 'plantToggle') {
  ///
  const sdk = useSdk();
  const { values } = useFormikContext<any>();

  /// Farmer
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();
  const { revitalizedStalk, revitalizedSeeds } = useRevitalized();

  const summary: FormTxnSummaryMap = useMemo(() => {
    const { SEEDS, STALK, BEAN, PODS, SPROUTS } = sdk.tokens;

    const grownStalk = normalizeBN(farmerSilo.stalk.grown);

    const earnedBeans = normalizeBN(farmerSilo.beans.earned);
    const earnedStalk = normalizeBN(farmerSilo.stalk.earned);
    const earnedSeeds = normalizeBN(farmerSilo.seeds.earned);

    const harvestablePods = normalizeBN(farmerField.harvestablePods);
    const rinsableSprouts = normalizeBN(farmerBarn.fertilizedSprouts);
    const claimableBeans = normalizeBN(
      farmerSilo.balances[BEAN.address]?.claimable?.amount
    );

    return {
      [FormTxn.MOW]: {
        title: 'Mow',
        tooltip: tooltips.mow,
        enabled: grownStalk.gt(0),
        summary: [
          {
            description: 'Grown Stalk',
            tooltip: tooltips.grownStalk,
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
      [FormTxn.PLANT]: {
        title: 'Plant',
        tooltip: tooltips.plant,
        enabled: earnedSeeds.gt(0),
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
            description: 'Plantable Seeds',
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
      [FormTxn.ENROOT]: {
        title: 'Enroot',
        tooltip: tooltips.enroot,
        enabled: revitalizedSeeds.gt(0) || revitalizedStalk.gt(0),
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
      [FormTxn.HARVEST]: {
        title: 'Harvest',
        tooltip: tooltips.harvest,
        enabled: harvestablePods.gt(0),
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
      [FormTxn.RINSE]: {
        title: 'Rinse',
        tooltip: tooltips.rinse,
        enabled: rinsableSprouts.gt(0),
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
            destination: mode === 'plantToggle' ? (values.destination || FarmToMode.INTERNAL) : values.destination,
          },
        ],
      },
      [FormTxn.CLAIM]: {
        title: 'Claim',
        tooltip: tooltips.claim,
        enabled: claimableBeans.gt(0),
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
    values.destination,
    mode
  ]);

  /**
   * Returns the total amount of beans claimable from a list of claimable actions
   */
  const getClaimable = useCallback(
    (_options?: FormTxn[]) => {
      const amount = _options?.reduce((prev, curr) => {
        const option = summary[curr] as FormTxnSummary;
        prev = prev.plus(normalizeBN(option?.claimable?.amount));
        return prev;
      }, ZERO_BN);

      const tokenValue = sdk.tokens.BEAN.fromHuman(amount?.toString() || '0');

      return {
        bn: amount || ZERO_BN,
        tokenValue,
      };
    },
    [summary, sdk.tokens.BEAN]
  );

  const canClaimBeans = useMemo(() => {
    const { bn } = getClaimable([
      FormTxn.CLAIM,
      FormTxn.RINSE,
      FormTxn.HARVEST,
    ]);
    return bn.gt(0);
  }, [getClaimable]);

  const canPlant = useMemo(() => {
    const earnedSeeds = normalizeBN(farmerSilo.seeds.earned);
    return earnedSeeds;
  }, [farmerSilo.seeds.earned]);

  return { summary, getClaimable, canClaimBeans, canPlant };
}
