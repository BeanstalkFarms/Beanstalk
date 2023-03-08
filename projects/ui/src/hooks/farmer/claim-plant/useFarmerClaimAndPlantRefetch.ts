import { useMemo, useCallback } from 'react';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { MayPromise } from '~/types';
import { ClaimPlantAction } from '~/util/ClaimPlant';

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
  /** 
   * actions that were performed 
   */
  actions: ClaimPlantAction[],
  /** 
   * Which app refetch functions are already being called to prevent unnecessary duplicated calls 
   */
  config?: RefetchConfig<boolean>,
  /** 
   * additional fetch functions 
   */
  additional?: (() => MayPromise<any>)[]
) => Promise<void>;

// -------------------------------------------------------------------------

export default function useFarmerClaimAndPlantRefetch() {
  /// Refetch functions
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBarn] = useFetchFarmerBarn();

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

  return [refetch] as const;
}
