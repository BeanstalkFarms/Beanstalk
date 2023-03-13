import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import {
  FormTxn,
  FormTxnActions,
  FormTxnBuilder,
  FormTxnParamsMap,
} from '~/util/FormTxns';

import useAccount from '~/hooks/ledger/useAccount';
import useBDV from '../../beanstalk/useBDV';
import useFarmerSilo from '../useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import useFarmerField from '../useFarmerField';
import useFarmerFertilizer from '../useFarmerFertilizer';
import useSdk from '../../sdk';
import { MayPromise } from '~/types';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';

// -------------------------------------------------------------------------

export type FormTxnRefetchFn =
  | 'farmerSilo'
  | 'farmerField'
  | 'farmerBalances'
  | 'farmerBarn';

export type FormTxnRefetchConfig<T> = Partial<{ [key in FormTxnRefetchFn]: T }>;

const refetchMapping: Record<FormTxn, FormTxnRefetchFn[]> = {
  [FormTxn.MOW]: ['farmerSilo'],
  [FormTxn.PLANT]: ['farmerSilo'],
  [FormTxn.ENROOT]: ['farmerSilo'],
  [FormTxn.CLAIM]: ['farmerSilo', 'farmerBalances'],
  [FormTxn.HARVEST]: ['farmerBalances', 'farmerField'],
  [FormTxn.RINSE]: ['farmerBalances', 'farmerBarn'],
};

type FormTxnRefetch = (
  /**
   * actions that were performed
   */
  actions: FormTxn[],
  /**
   * Which app refetch functions are already being called to prevent unnecessary duplicated calls
   */
  config?: FormTxnRefetchConfig<boolean>,
  /**
   * additional fetch functions
   */
  additional?: (() => MayPromise<any>)[]
) => Promise<void>;

// -------------------------------------------------------------------------

export default function useFarmerFormTxns() {
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

  const formTxnMap: {
    [key in FormTxn]: (
      params?: Partial<FormTxnParamsMap[key]>
    ) => FormTxnActions;
  } = useMemo(() => {
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
      [FormTxn.MOW]: (params) => {
        const mow = FormTxnBuilder.getFunction(FormTxn.MOW);
        return mow(sdk, { account: account || '', ...params });
      },
      [FormTxn.PLANT]: (_params: any) => {
        const plant = FormTxnBuilder.getFunction(FormTxn.PLANT);
        return plant(sdk, {});
      },
      [FormTxn.ENROOT]: (params) => {
        const unripe = [...sdk.tokens.unripeTokens];
        const crates = unripe.reduce((prev, token) => {
          const balance = farmerSilo.balances[token.address];
          const depositCrates = balance?.deposited.crates;

          prev[token.address] = depositCrates?.filter((crate) => {
            const bdv = getBDV(token).times(crate.amount).toFixed(6, 1);
            return new BigNumber(bdv).gt(crate.bdv);
          });

          return prev;
        }, {} as { [addr: string]: DepositCrate[] });

        const enroot = FormTxnBuilder.getFunction(FormTxn.ENROOT);
        return enroot(sdk, { crates, ...params });
      },
      [FormTxn.CLAIM]: (params) => {
        const claim = FormTxnBuilder.getFunction(FormTxn.CLAIM);
        return claim(sdk, { seasons, ...params });
      },
      [FormTxn.HARVEST]: (params) => {
        const harvest = FormTxnBuilder.getFunction(FormTxn.HARVEST);
        return harvest(sdk, { plotIds, ...params });
      },
      [FormTxn.RINSE]: (params) => {
        const rinse = FormTxnBuilder.getFunction(FormTxn.RINSE);
        return rinse(sdk, {
          tokenIds: fertilizerIds,
          ...params,
        });
      },
    };
  }, [
    account,
    farmerBarn.balances,
    farmerField.harvestablePlots,
    farmerSilo.balances,
    getBDV,
    sdk,
  ]);

  const getEstimateGas = useCallback(
    (action: FormTxn) => {
      const getFunction = formTxnMap[action]();
      return getFunction.estimateGas;
    },
    [formTxnMap]
  );

  const getGenerators = useCallback(
    (action: FormTxn) => {
      const getFunctions = formTxnMap[action]();
      return getFunctions.getSteps();
    },
    [formTxnMap]
  );

  const refetchMap = useMemo(
    () => ({
      farmerSilo: refetchFarmerSilo,
      farmerField: refetchFarmerField,
      farmerBalances: refetchFarmerBalances,
      farmerBarn: refetchFarmerBarn,
    }),
    [
      refetchFarmerBalances,
      refetchFarmerBarn,
      refetchFarmerField,
      refetchFarmerSilo,
    ]
  );

  const refetch: FormTxnRefetch = useCallback(
    async (actions, config, additional) => {
      const map: FormTxnRefetchConfig<() => MayPromise<any>> = {};

      [...actions].forEach((action) => {
        refetchMapping[action]?.forEach((key: FormTxnRefetchFn) => {
          if (!config?.[key]) {
            map[key] = refetchMap[key];
          }
        });
      });

      if (config) {
        Object.entries(config).forEach(([k, v]) => {
          const key = k as FormTxnRefetchFn;
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

  return {
    data: formTxnMap,
    getGenerators,
    getEstimateGas,
    refetch,
  };
}
