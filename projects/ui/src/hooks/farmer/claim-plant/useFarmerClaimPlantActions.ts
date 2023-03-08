import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { ClaimAndPlantFormState } from '~/components/Common/Form';
import ClaimPlant, {
  ClaimPlantActionMap,
  ClaimPlantAction,
  ClaimPlantActionable,
} from '~/util/ClaimPlant';
import useAccount from '~/hooks/ledger/useAccount';
import useBDV from '../../beanstalk/useBDV';
import useFarmerSilo from '../useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import useFarmerField from '../useFarmerField';
import useFarmerFertilizer from '../useFarmerFertilizer';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import useSdk from '../../sdk';
import { MayPromise } from '~/types';
import { normalizeBN } from '~/util';

export type FarmerRefetchFn =
  | 'farmerSilo'
  | 'farmerField'
  | 'farmerBalances'
  | 'farmerBarn';

export type RefetchConfig<T> = Partial<{ [key in FarmerRefetchFn]: T }>;

// -------------------------------------------------------------------------

const actionToRefetch: Record<ClaimPlantAction, FarmerRefetchFn[]> = {
  [ClaimPlantAction.MOW]: ['farmerSilo'],
  [ClaimPlantAction.PLANT]: ['farmerSilo'],
  [ClaimPlantAction.ENROOT]: ['farmerSilo'],
  [ClaimPlantAction.CLAIM]: ['farmerSilo', 'farmerBalances'],
  [ClaimPlantAction.HARVEST]: ['farmerBalances', 'farmerField'],
  [ClaimPlantAction.RINSE]: ['farmerBalances', 'farmerBarn'],
};

type ClaimPlantRefetch = (
  /** actions that were performed */
  actions: Set<ClaimPlantAction>,
  /** Which app refetch functions are already being called to prevent unnecessary duplicated calls */
  config?: RefetchConfig<boolean>,
  /** additional functions to fetch */
  additional?: (() => MayPromise<any>)[]
) => Promise<void>;

type ClaimPlantBuildAction = (actions?: ClaimPlantAction[]) => Partial<{
  [key in ClaimPlantAction]: ClaimPlantActionable;
}>;

// -------------------------------------------------------------------------

// take in sdk as a param to allow for testing
export default function useFarmerClaimPlantActions() {
  const sdk = useSdk();
  /// Farmer
  const account = useAccount();

  /// Farmer data
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();

  /// Refetch functions
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBarn] = useFetchFarmerBarn();

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
    const seasons = beanBalance?.claimable?.crates.map((c) => c.season.toString()) || [];
    const plotIds = plots.map((harvestIdx) =>
      sdk.tokens.BEAN.fromBlockchain(harvestIdx).toBlockchain()
    );
    const fertilizerIds = farmerBarn.balances.map((bal) =>
      bal.token.id.toString()
    );
    const harvestablePods = normalizeBN(farmerField.harvestablePods);
    const rinsableSprouts = normalizeBN(farmerBarn.fertilizedSprouts);
    const claimableBeans = normalizeBN(beanBalance?.claimable.amount);

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
    farmerBarn.fertilizedSprouts,
    farmerField.harvestablePlots,
    farmerField.harvestablePods,
    farmerSilo.balances,
    sdk,
  ]);

  const refetchMap = useMemo(() => ({
      farmerSilo: refetchFarmerSilo,
      farmerField: refetchFarmerField,
      farmerBalances: refetchFarmerBalances,
      farmerBarn: refetchFarmerBarn,
    }), [refetchFarmerBalances, refetchFarmerBarn, refetchFarmerField, refetchFarmerSilo]);

  const refetch: ClaimPlantRefetch = useCallback(
    async (actions, config, additional) => {
      const map: RefetchConfig<() => MayPromise<any>> = {};

      [...actions].forEach((action) => {
        actionToRefetch[action]?.forEach((key: FarmerRefetchFn) => {
          if (!config?.[key]) {
            map[key] = refetchMap[key];
          }
        });
      });

      if (config) {
        Object.entries(config).forEach(([k, v]) => {
          const key = k as FarmerRefetchFn;
          if (v && !(key in map)) {
            map[key] = refetchMap[key];
          }
        });
      }

      await Promise.all(
        [...Object.values(map), ...(additional || [])].map((fn) => fn())
      );
    },
    [refetchMap]
  );

  const buildActions: ClaimPlantBuildAction = useCallback(
    (actions?: ClaimPlantAction[]) => {
      if (!actions || !actions.length) return {};
      return actions.reduce((prev, curr) => {
        prev[curr] = claimAndPlantActions[curr]();
        return prev;
      }, {} as Partial<{ [action in ClaimPlantAction]: ClaimPlantActionable }>);
    },
    [claimAndPlantActions]
  );

  const compile = useCallback((
    /** */
    formState: ClaimAndPlantFormState, 
    /** */
    options?: { 
      /** whether or not to filter out mow actions */
      isMowing?: boolean
    }
  ) => {
    const { farmActions } = formState;

    const deduplicated = ClaimPlant.deduplicate(
      buildActions(farmActions.selected || []),
      buildActions(farmActions.additional || []),
      options?.isMowing || false,
    );
    
    return deduplicated;
  }, [buildActions]);

  return {
    actions: claimAndPlantActions,
    refetch,
    compile,
    buildActions,
  };
}
