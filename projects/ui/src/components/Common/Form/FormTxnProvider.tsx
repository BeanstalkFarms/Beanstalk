import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FarmToMode, Token, TokenValue } from '@beanstalk/sdk';
import { FC, MayPromise } from '~/types';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useBDV from '~/hooks/beanstalk/useBDV';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import {
  FormTxnBundler,
  ClaimFarmStep,
  EnrootFarmStep,
  HarvestFarmStep,
  MowFarmStep,
  PlantFarmStep,
  RinseFarmStep,
  FormTxn,
} from '~/lib/Txn';
import usePlantAndDoX from '~/hooks/farmer/form-txn/usePlantAndDoX';

// -------------------------------------------------------------------------

export type FormTxnRefetchFn =
  | 'farmerSilo'
  | 'farmerField'
  | 'farmerBalances'
  | 'farmerBarn'
  | 'beanstalkSilo';

export type FormTxnRefetchConfig<T> = Partial<{ [key in FormTxnRefetchFn]: T }>;

const refetchMapping: Record<FormTxn, FormTxnRefetchFn[]> = {
  [FormTxn.MOW]: ['farmerSilo'],
  [FormTxn.PLANT]: ['farmerSilo'],
  [FormTxn.ENROOT]: ['farmerSilo', 'beanstalkSilo'],
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

const useInitFormTxnContext = () => {
  const sdk = useSdk();

  /// Farmer
  const account = useAccount();
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();

  /// Refetch functions
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBarn] = useFetchFarmerBarn();
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Helpers
  const getBDV = useBDV();
  const plantAndDoX = usePlantAndDoX();

  /// Context State
  const [txnBundler, setTxnBundler] = useState(new FormTxnBundler(sdk, {}));
  const [destination, setDestination] = useState<FarmToMode | undefined>();

  /// On any change, update the txn bundler
  useEffect(() => {
    const { BEAN } = sdk.tokens;
    const earnedBeans = BEAN.amount(farmerSilo.beans.earned.toString());
    const enrootCrates = EnrootFarmStep.pickUnripeCrates(
      sdk.tokens.unripeTokens,
      farmerSilo.balances,
      getBDV
    );
    const _crates = Object.values(enrootCrates);
    const canEnroot = _crates && _crates?.some((crates) => crates?.length > 0);
    const fertilizerIds = farmerBarn.balances.map((bal) =>
      bal.token.id.toString()
    );
    const rinsable = farmerBarn.fertilizedSprouts;
    const plots = Object.keys(farmerField.harvestablePlots);
    const plotIds = plots.map(
      (plotId) => TokenValue.fromHuman(plotId, 6).blockchainString
    );
    const claimable = farmerSilo.balances[sdk.tokens.BEAN.address]?.claimable;
    const seasons = claimable?.crates.map((c) => c.season.toString());
   
    const tokensWithStalk: Map<Token, TokenValue> = new Map();
    farmerSilo.stalk.grownByToken.forEach((value, token) => { 
      if (value.gt(0)) {
        tokensWithStalk.set(token, value);
      };
    });

    const farmSteps = {
      [FormTxn.MOW]: account && tokensWithStalk.size > 0
        ? new MowFarmStep(sdk, account, tokensWithStalk).build()
        : undefined,
      [FormTxn.PLANT]: earnedBeans.gt(0)
        ? new PlantFarmStep(sdk).build()
        : undefined,
      [FormTxn.ENROOT]: canEnroot
        ? new EnrootFarmStep(sdk, enrootCrates).build()
        : undefined,
      [FormTxn.HARVEST]: plotIds.length
        ? new HarvestFarmStep(sdk, plotIds).build()
        : undefined,
      [FormTxn.RINSE]: rinsable.gt(0)
        ? new RinseFarmStep(sdk, fertilizerIds, destination || FarmToMode.INTERNAL).build()
        : undefined,
      [FormTxn.CLAIM]: seasons?.length
        ? new ClaimFarmStep(sdk, BEAN, seasons).build(BEAN)
        : undefined,
    };
    console.debug('[FormTxnProvider] updating txn bundler...', farmSteps);
    setTxnBundler(new FormTxnBundler(sdk, farmSteps));
  }, [
    account,
    farmerBarn.balances,
    farmerBarn.fertilizedSprouts,
    farmerField.harvestablePlots,
    farmerSilo.balances,
    farmerSilo.beans.earned,
    farmerSilo.stalk.grownByToken,
    getBDV,
    sdk,
    destination
  ]);

  useEffect(() => {
    console.debug('[FormTxnProvider][map]: ', txnBundler.getMap());
  }, [txnBundler]);

  const refetchMap = useMemo(
    () => ({
      farmerSilo: refetchFarmerSilo,
      farmerField: refetchFarmerField,
      farmerBalances: refetchFarmerBalances,
      farmerBarn: refetchFarmerBarn,
      beanstalkSilo: refetchSilo,
    }),
    [
      refetchFarmerBalances,
      refetchFarmerBarn,
      refetchFarmerField,
      refetchFarmerSilo,
      refetchSilo,
    ]
  );

  /**
   * Refetches the data for the given actions
   */
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

      /// set a new instance of the txn bundler
      setTxnBundler(new FormTxnBundler(sdk, {}));

      await Promise.all(
        [...Object.values(map), ...(additional || [])].map((fn) => fn())
      );
    },
    [refetchMap, sdk]
  );

  return {
    txnBundler,
    plantAndDoX,
    refetch,
    setDestination
  } as const;
};

export const FormTxnBuilderContext = React.createContext<
  ReturnType<typeof useInitFormTxnContext> | undefined
>(undefined);

const FormTxnProvider: FC<{}> = ({ children }) => {
  const values = useInitFormTxnContext();

  return (
    <FormTxnBuilderContext.Provider value={values}>
      {children}
    </FormTxnBuilderContext.Provider>
  );
};

export default FormTxnProvider;
