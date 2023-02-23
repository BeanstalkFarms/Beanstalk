import { useCallback } from 'react';
import {
  ClaimPlantAction
} from '~/util/ClaimPlant';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { MayPromise } from '~/types';

export type ClaimPlantRefetchConfig<T> = {
  farmerSilo?: T;
  farmerField?: T 
  farmerBalances?: T;
  farmerBarn?: T;
}

type RefetchFunctionsMap = ClaimPlantRefetchConfig<() => MayPromise<any>>;

type RefetchConfig = ClaimPlantRefetchConfig<boolean>;

// -------------------------------------------------------------------------

const claimPlantRefetchConfig: Record<ClaimPlantAction, (keyof RefetchConfig)[]> = {
  [ClaimPlantAction.MOW]:     ['farmerSilo'],
  [ClaimPlantAction.PLANT]:   ['farmerSilo'],
  [ClaimPlantAction.ENROOT]:  ['farmerSilo'],
  [ClaimPlantAction.CLAIM]:   ['farmerSilo', 'farmerBalances'],
  [ClaimPlantAction.HARVEST]: ['farmerBalances', 'farmerField'],
  [ClaimPlantAction.RINSE]:   ['farmerBalances', 'farmerBarn'],
};

export default function useRefetchClaimAndPlant() {
  /// Refetch functions
  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerField]    = useFetchFarmerField();
  const [refetchFarmerBarn]     = useFetchFarmerBarn();

  const getRefetchFn = useCallback((key: keyof RefetchConfig): (undefined | (() => MayPromise<any>)) => {
    switch (key) {
      case 'farmerSilo': {
        return refetchFarmerSilo;
      }
      case 'farmerField': {
        return refetchFarmerField;
      }
      case 'farmerBalances': {
        return refetchFarmerBalances;
      }
      case 'farmerBarn': {
        return refetchFarmerBarn;
      }
      default: 
        return undefined;
    }
  }, [refetchFarmerBalances, refetchFarmerBarn, refetchFarmerField, refetchFarmerSilo]);

  const fetch = useCallback(async (
    /** actions that were performed */
    actions: Set<ClaimPlantAction>, 
    /** Which app refetch functions are already being called to prevent unnecessary duplicated calls */
    config?: RefetchConfig,
    /** additional functions to fetch */
    additional?: (() => MayPromise<any>)[],
  ) => {
    const refetchFunctions = [...actions].reduce<RefetchFunctionsMap>((prev, action) => {
      claimPlantRefetchConfig[action].forEach((k) => {
        const key = k as keyof RefetchConfig;
        if (config && config[key] && (!(key in prev))) {
          const refetchFn = getRefetchFn(key);
          if (refetchFn) {
            prev[key] = refetchFn;
          }
        } else if (!(key in prev)) {
          const refetchFn = getRefetchFn(key);
          if (refetchFn) {
            prev[key] = refetchFn;
          }
        }
      });

      return prev;
    }, {});

    return Promise.all(
      [...Object.values(refetchFunctions), ...(additional || [])].map((fn) => fn())
    );
  }, [getRefetchFn]);

  return [fetch] as const;
}
