import React, { useCallback, useMemo } from 'react';
import { FarmFromMode, FarmToMode, TokenValue } from '@beanstalk/sdk';
import { FC, MayPromise } from '~/types';
import { FormTxnBuilder } from '~/lib/Txn';
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
import { FormTxnStrategy } from '~/lib/Txn/FormTxnBuilder';
import { FormTxn } from '~/util';
import { makeLocalOnlyStep } from '~/lib/Txn/util';
import { StepsWithOptions } from '~/lib/Txn/Strategy';

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
  const txnBuilder = useMemo(() => new FormTxnBuilder(sdk), [sdk]);

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

  const formTxnMap: {
    [key in FormTxn]: () => FormTxnStrategy;
  } = useMemo(() => {
    const { BEAN } = sdk.tokens;

    const beanBalance = farmerSilo.balances[BEAN.address];
    const plots = Object.keys(farmerField.harvestablePlots);
    const plotIds = plots.map(
      (plotId) => TokenValue.fromHuman(plotId, 6).blockchainString
    );
    const seasons =
      beanBalance?.claimable?.crates.map((c) => c.season.toString()) || [];
    const fertilizerIds = farmerBarn.balances.map((bal) =>
      bal.token.id.toString()
    );

    const actions = txnBuilder.strategies;

    return {
      [FormTxn.MOW]: () => {
        if (!account) {
          throw new Error('Signer not found');
        }
        return new actions.Silo.Mow(sdk, { account: account || '' });
      },
      [FormTxn.PLANT]: () => new actions.Silo.Plant(sdk),
      [FormTxn.ENROOT]: () => {
        const _crates = actions.Silo.Enroot.pickCrates(
          farmerSilo.balances,
          getBDV
        );
        return new actions.Silo.Enroot(sdk, { crates: _crates });
      },
      [FormTxn.CLAIM]: () =>
        new actions.Silo.Claim(sdk, { tokenIn: BEAN, seasons }),
      [FormTxn.HARVEST]: () => new actions.Field.Harvest(sdk, { plotIds }),
      [FormTxn.RINSE]: () =>
        new actions.Barn.Rinse(sdk, { tokenIds: fertilizerIds }),
    };
  }, [
    account,
    farmerBarn.balances,
    farmerField.harvestablePlots,
    farmerSilo.balances,
    txnBuilder.strategies,
    getBDV,
    sdk,
  ]);

  const getEstimateGas = useCallback(
    (action: FormTxn) => {
      if (!(action in formTxnMap)) {
        throw new Error('Invalid action');
      }
      const actionFunctions = formTxnMap[action]();
      return actionFunctions.estimateGas;
    },
    [formTxnMap]
  );

  const getStrategy = useCallback(
    (action: FormTxn) => {
      if (!(action in formTxnMap)) {
        throw new Error('Invalid action');
      }
      return formTxnMap[action]();
    },
    [formTxnMap]
  );

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

      await Promise.all(
        [...Object.values(map), ...(additional || [])].map((fn) => fn())
      );
    },
    [refetchMap]
  );

  const getActionsPerformed = useCallback(
    (items: (FormTxn[] | undefined)[]) => {
      const set = new Set<FormTxn>();

      items.forEach((item) => {
        if (item) {
          item.forEach((action) => {
            set.add(action);
          });
        }
      });
      return Array.from(set);
    },
    []
  );

  /**
   * if the user requested to transfer beans to an external address,
   * return the steps
   */
  const getTransferBeanSteps = useCallback(
    (
      totalClaimAmount: TokenValue,
      claimedBeansUsed: TokenValue,
      transferDestination: FarmToMode
    ) => {
      if (!account) {
        throw new Error('Signer not found');
      }

      const transferAmount = totalClaimAmount.sub(claimedBeansUsed);
      const isToExternal = transferDestination === FarmToMode.EXTERNAL;
      const shouldTransfer = isToExternal && transferAmount.gt(0);

      const steps: StepsWithOptions[] = [];

      if (!shouldTransfer) return undefined;

      steps.push(
        makeLocalOnlyStep({
          name: 'pre-transfer',
          amount: {
            overrideAmount: transferAmount,
          },
        })
      );
      steps.push({
        steps: [
          new sdk.farm.actions.TransferToken(
            sdk.tokens.BEAN.address,
            account,
            FarmFromMode.INTERNAL_TOLERANT,
            FarmToMode.EXTERNAL
          ),
        ],
      });

      return steps;
    },
    [account, sdk.farm.actions.TransferToken, sdk.tokens.BEAN.address]
  );

  return {
    txnBuilder,
    getActionsPerformed,
    getTransferBeanSteps,
    getEstimateGas,
    getStrategy,
    refetch,
  };
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
