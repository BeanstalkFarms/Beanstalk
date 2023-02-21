import {
  BeanstalkSDK,
  TokenValue,
} from '@beanstalk/sdk';
import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import ClaimPlant, { 
  ClaimPlantAction, 
  ClaimPlantActionMap, 
  ClaimPlantActionData
} from '~/util/ClaimPlant';
import useAccount from '~/hooks/ledger/useAccount';
import useBDV from './useBDV';
import useFarmerSilo from '../farmer/useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import useFarmerField from '../farmer/useFarmerField';
import useFarmerFertilizer from '../farmer/useFarmerFertilizer';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';

type ClaimPlantRefetchConfig = { 
  farmerSilo?: (() => Promise<any>) | (() => void); 
  farmerField?: (() => Promise<any>) | (() => void); 
  farmerBalances?: (() => Promise<any>) | (() => void); 
  beanstalkBarn?: (() => Promise<any>) | (() => void);
};

// -------------------------------------------------------------------------

const claimPlantRefetchConfig: Record<ClaimPlantAction, (keyof ClaimPlantRefetchConfig)[]> = {
  [ClaimPlantAction.MOW]:     ['farmerSilo'],
  [ClaimPlantAction.PLANT]:   ['farmerSilo'],
  [ClaimPlantAction.ENROOT]:  ['farmerSilo'],
  [ClaimPlantAction.CLAIM]:   ['farmerSilo', 'farmerBalances'],
  [ClaimPlantAction.HARVEST]: ['farmerBalances', 'farmerField'],
  [ClaimPlantAction.RINSE]:   ['farmerBalances', 'beanstalkBarn'],
};

function isClaimAction(action: ClaimPlantAction) {
  return (action === ClaimPlantAction.RINSE || action === ClaimPlantAction.HARVEST || action === ClaimPlantAction.CLAIM);
}

function isPlantAction(action: ClaimPlantAction) {
  return (action === ClaimPlantAction.MOW || action === ClaimPlantAction.PLANT || action === ClaimPlantAction.ENROOT);
}

function injectOnlyLocal(name: string, amount: TokenValue) {
  return async () => ({
    name,
    amountOut: amount.toBigNumber(),
    prepare: () => ({ target: '', callData: '' }),
    decode: () => undefined,
    decodeResult: () => undefined,
  });
}

// -------------------------------------------------------------------------

// take in sdk as a param to allow for testing
export default function useClaimAndPlantActions(sdk: BeanstalkSDK) {
  /// Farmer
  const account = useAccount();

  /// Farmer data
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();

  /// Refetch functions
  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerField]    = useFetchFarmerField();
  const [refetchBarn]           = useFetchFarmerBarn();

  /// Helpers
  const getBDV = useBDV();

  const cratesForEnroot = useMemo(
    () => Array.from(sdk.tokens.unripeTokens)
      .reduce<{ [addr: string]: DepositCrate[] }>((prev, token) => {
        const depositCrates = farmerSilo.balances[token.address]?.deposited.crates;
        const crates = depositCrates?.filter((crate) =>
          new BigNumber(getBDV(token).times(crate.amount).toFixed(6, 1)).gt(crate.bdv)
        );
        prev[token.address] = crates;
        return prev;
      }, {}),
    [farmerSilo.balances, getBDV, sdk.tokens.unripeTokens]
  );

  const claimAndPlantActions: ClaimPlantActionMap = useMemo(() => {
    if (!account) {
      throw new Error('Wallet connection is required');
    }
    const crates = farmerSilo.balances[sdk.tokens.BEAN.address]?.claimable?.crates || [];
    const plotIds = Object.keys(farmerField.harvestablePlots).map(
      (harvestIndex) => sdk.tokens.PODS.fromBlockchain(harvestIndex).blockchainString
    );
    const fertilizerIds = farmerBarn.balances.map((bal) => bal.token.id.toString());

    return {
      [ClaimPlantAction.MOW]: (params) => ClaimPlant.getAction(ClaimPlantAction.MOW)(sdk, { account, ...params }),
      [ClaimPlantAction.PLANT]: (_params) => ClaimPlant.getAction(ClaimPlantAction.PLANT)(sdk),
      [ClaimPlantAction.ENROOT]: (params) => ClaimPlant.getAction(ClaimPlantAction.ENROOT)(sdk, { crates: cratesForEnroot, ...params }),
      [ClaimPlantAction.CLAIM]: (params) => ClaimPlant.getAction(ClaimPlantAction.CLAIM)(sdk, { seasons: crates.map((crate) => crate.season.toString()), ...params }),
      [ClaimPlantAction.HARVEST]: (params) => ClaimPlant.getAction(ClaimPlantAction.HARVEST)(sdk, { plotIds: plotIds, ...params }),
      [ClaimPlantAction.RINSE]: (params) => ClaimPlant.getAction(ClaimPlantAction.RINSE)(sdk, { tokenIds: fertilizerIds, ...params }),
    };
  }, [account, cratesForEnroot, farmerBarn.balances, farmerField.harvestablePlots, farmerSilo.balances, sdk]);

  const refetch = useCallback(async (
    /** actions that were performed */
    actions: Set<ClaimPlantAction>, 
    /** Which app refetch functions are already being called to prevent unnecessary duplicated calls */
    config?: ClaimPlantRefetchConfig,
    /** additional functions to fetch */
    additional?: ((() => Promise<any>) | (() => void))[],
  ) => {
    const refetchFunctions = [...actions].reduce<ClaimPlantRefetchConfig>((prev, action) => {
      claimPlantRefetchConfig[action].forEach((k) => {
        const key = k as keyof ClaimPlantRefetchConfig;
        if (config && config[key] && !(key in prev)) {
          prev[key] = config[key];
        }
        if (!(key in prev)) {
          switch (key) {
            case 'farmerSilo': {
              prev[key] = refetchFarmerSilo;
              break;
            }
            case 'farmerField': {
              prev[key] = refetchFarmerField;
              break;
            }
            case 'farmerBalances': {
              prev[key] = refetchFarmerBalances;
              break;
            }
            case 'beanstalkBarn': {
              prev[key] = refetchBarn;
              break;
            }
            default: 
              break;
          }
        }
      });
      return prev;
    }, {});
    return Promise.all(
      [...Object.values(refetchFunctions), ...(additional || [])].map((fn) => fn())
    );
  }, [refetchBarn, refetchFarmerBalances, refetchFarmerField, refetchFarmerSilo]);

  // reduce an array of actions to a map of the actions for each step
  const buildActions = useCallback((actions: ClaimPlantAction[]) => 
    actions.reduce<Partial<{ [action in ClaimPlantAction]: ClaimPlantActionData }>>((prev, curr) => {
      prev[curr] = claimAndPlantActions[curr]();
      return prev;
    }, {}), 
    [claimAndPlantActions]
  );

  return { 
    actions: claimAndPlantActions,
    refetch,
    buildActions,
    isClaimAction,
    isPlantAction,
  };
}
