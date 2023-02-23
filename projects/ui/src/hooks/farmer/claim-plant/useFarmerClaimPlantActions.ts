import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import ClaimPlant, {
  ClaimPlantActionMap,
  ClaimPlantActionData,
  ClaimPlantAction,
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

// -------------------------------------------------------------------------

// take in sdk as a param to allow for testing
export default function useFarmerClaimPlantActions(): {
  actions: ClaimPlantActionMap;
  refetch: ClaimPlantRefetch;
  buildActions: (
    actions: ClaimPlantAction[]
  ) => Partial<{ [key in ClaimPlantAction]: ClaimPlantActionData }>;
} {
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
    const tokens = [...sdk.tokens.unripeTokens];
    return tokens.reduce((prev, token) => {
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
    if (!account) throw new Error('Wallet connection is required');

    const beanBalance = farmerSilo.balances[sdk.tokens.BEAN.address];
    const plots = Object.keys(farmerField.harvestablePlots);

    const crates = beanBalance?.claimable?.crates || [];
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
        return claim(sdk, { crates, ...params });
      },
      [ClaimPlantAction.HARVEST]: (params) => {
        const harvest = ClaimPlant.getAction(ClaimPlantAction.HARVEST);
        return harvest(sdk, { plotIds, ...params });
      },
      [ClaimPlantAction.RINSE]: (params) => {
        const rinse = ClaimPlant.getAction(ClaimPlantAction.RINSE);
        return rinse(sdk, { tokenIds: fertilizerIds, ...params });
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

  const refetch: ClaimPlantRefetch = useCallback(
    async (actions, config, additional) => {
      const refetchMap = {
        farmerSilo: refetchFarmerSilo,
        farmerField: refetchFarmerField,
        farmerBalances: refetchFarmerBalances,
        farmerBarn: refetchFarmerBarn,
      };

      const refetchFunctions = [...actions].reduce((prev, action) => {
        actionToRefetch[action].forEach((key: FarmerRefetchFn) => {
          if (config && config[key] && !prev[key]) {
            prev[key] = refetchMap[key];
          } else if (!prev[key]) {
            prev[key] = refetchMap[key];
          }
        });

        return prev;
      }, {} as RefetchConfig<() => MayPromise<any>>);

      const allRefetchFunctions = [
        ...Object.values(refetchFunctions),
        ...(additional || []),
      ];

      await Promise.all(allRefetchFunctions.map((fn) => fn()));
    },
    [
      refetchFarmerBalances,
      refetchFarmerBarn,
      refetchFarmerField,
      refetchFarmerSilo,
    ]
  );

  const buildActions = useCallback(
    (actions: ClaimPlantAction[]) =>
      actions.reduce((prev, curr) => {
        prev[curr] = claimAndPlantActions[curr]();
        return prev;
      }, {} as Partial<{ [action in ClaimPlantAction]: ClaimPlantActionData }>),
    [claimAndPlantActions]
  );

  return {
    actions: claimAndPlantActions,
    refetch,
    buildActions,
  };
}
