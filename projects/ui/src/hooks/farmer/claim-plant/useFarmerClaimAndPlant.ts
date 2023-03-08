import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { StepGenerator } from '@beanstalk/sdk';
import { ClaimAndPlantFormState } from '~/components/Common/Form';
import ClaimPlant, {
  ClaimPlantActionMap,
  ClaimPlantAction,
  ClaimPlantFormPresets,
} from '~/util/ClaimPlant';
import useAccount from '~/hooks/ledger/useAccount';
import useBDV from '../../beanstalk/useBDV';
import useFarmerSilo from '../useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import useFarmerField from '../useFarmerField';
import useFarmerFertilizer from '../useFarmerFertilizer';
import useSdk from '../../sdk';

type ClaimPlantActionStepsMap = Partial<{
  [key in ClaimPlantAction]: StepGenerator[];
}>;

// take in sdk as a param to allow for testing
export default function useFarmerClaimPlant() {
  const sdk = useSdk();
  /// Farmer
  const account = useAccount();

  /// Farmer data
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();

  /// Helpers
  const getBDV = useBDV();

  const cratesForEnroot = useMemo(() => {
    const unripe = [...sdk.tokens.unripeTokens];
    return unripe.reduce((prev, token) => {
      const balance = farmerSilo.balances[token.address];
      const depositCrates = balance?.deposited.crates;

      prev[token.address] = depositCrates?.filter((crate) => {
        const bdv = getBDV(token).times(crate.amount).toFixed(6, 1);
        return new BigNumber(bdv).gt(crate.bdv);
      });

      return prev;
    }, {} as { [addr: string]: DepositCrate[] });
  }, [farmerSilo.balances, getBDV, sdk.tokens.unripeTokens]);

  const claimAndPlantActions: ClaimPlantActionMap = useMemo(() => {
    const { BEAN } = sdk.tokens;

    const beanBalance = farmerSilo.balances[BEAN.address];
    const plots = Object.keys(farmerField.harvestablePlots);
    const seasons =
      beanBalance?.claimable?.crates.map((c) => c.season.toString()) || [];
    const plotIds = plots.map((harvestIdx) =>
      sdk.tokens.BEAN.fromBlockchain(harvestIdx).toBlockchain()
    );
    const fertilizerIds = farmerBarn.balances.map((bal) =>
      bal.token.id.toString()
    );

    return {
      [ClaimPlantAction.MOW]: (params) => {
        const mow = ClaimPlant.getAction(ClaimPlantAction.MOW);
        return mow(sdk, { account, ...params });
      },
      [ClaimPlantAction.PLANT]: (_params) => {
        const plant = ClaimPlant.getAction(ClaimPlantAction.PLANT);
        return plant(sdk);
      },
      [ClaimPlantAction.ENROOT]: (params) => {
        const enroot = ClaimPlant.getAction(ClaimPlantAction.ENROOT);
        return enroot(sdk, { crates: cratesForEnroot, ...params });
      },
      [ClaimPlantAction.CLAIM]: (params) => {
        const claim = ClaimPlant.getAction(ClaimPlantAction.CLAIM);
        return claim(sdk, { seasons, ...params });
      },
      [ClaimPlantAction.HARVEST]: (params) => {
        const harvest = ClaimPlant.getAction(ClaimPlantAction.HARVEST);
        return harvest(sdk, { plotIds, ...params });
      },
      [ClaimPlantAction.RINSE]: (params) => {
        const rinse = ClaimPlant.getAction(ClaimPlantAction.RINSE);
        return rinse(sdk, {
          tokenIds: fertilizerIds,
          ...params,
        });
      },
    };
  }, [
    account,
    cratesForEnroot,
    farmerBarn.balances,
    farmerField.harvestablePlots,
    farmerSilo.balances,
    sdk,
  ]);

  const actionsToSteps = useCallback(
    (actions: ClaimPlantAction[] | undefined) => {
      const map: ClaimPlantActionStepsMap = {};
      if (!actions) return map;

      actions.forEach((action) => {
        const steps = claimAndPlantActions[action]?.().steps;
        if (steps) map[action] = steps;
      });

      return map;
    },
    [claimAndPlantActions]
  );

  // return the steps for the given form state
  const compile = useCallback((farmActions: ClaimAndPlantFormState['farmActions']) => {
    const preset = ClaimPlantFormPresets[farmActions.preset];
    // get steps for each set of actions
    const primaryActions = actionsToSteps(farmActions.selected);
    const additionalActions = actionsToSteps(farmActions.additional);

    // deduplicate actions. duplicated actions in primary are removed from additional
    Object.keys(primaryActions).forEach((pKey) => {
      const key = pKey as ClaimPlantAction;
      if (key in additionalActions) {
        delete additionalActions[key];
      }
    });

    // set of all actions performed
    const actionsPerformed = new Set<ClaimPlantAction>([
      ...Object.keys(primaryActions),
      ...Object.keys(additionalActions),
    ] as ClaimPlantAction[]);

    // deduplicate actions that are implied from performing another action
    [...actionsPerformed]
      .reduce<Set<ClaimPlantAction>>((prev, curr) => {
        const implied = ClaimPlant.config.implied[curr];
        if (implied) {
          implied.forEach((action) => {
            prev.add(action);
          });
        }
        return prev;
      }, new Set(preset.required || []))
      .forEach((action) => {
        if (!actionsPerformed.has(action)) return;
        actionsPerformed.delete(action);
        if (action in primaryActions) {
          delete primaryActions[action];
        }
        if (action in additionalActions) {
          delete additionalActions[action];
        }
      });

    return {
      actionsPerformed: [...actionsPerformed],
      primaryActions: Object.values(primaryActions).flat(),
      additionalActions: Object.values(additionalActions).flat(),
    };
  }, [actionsToSteps]);

  return {
    actions: claimAndPlantActions,
    compile,
  };
}
