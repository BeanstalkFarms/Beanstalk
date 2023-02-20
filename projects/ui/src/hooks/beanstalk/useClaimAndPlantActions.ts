import {
  BeanstalkSDK,
  FarmToMode,
  TokenValue,
  StepGenerator,
  BasicPreparedResult,
  FarmWorkflow,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import useAccount from '~/hooks/ledger/useAccount';
import useBDV from './useBDV';
import useFarmerSilo from '../farmer/useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import useFarmerField from '../farmer/useFarmerField';
import useFarmerFertilizer from '../farmer/useFarmerFertilizer';

export enum ClaimPlantAction {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type ClaimPlantActionData = {
  txn: {
    /**
     * workflow steps to execute
     */
    steps: StepGenerator<BasicPreparedResult>[];
    /**
     * function to estimate gas of the transaction
     */
    estimateGas: () => Promise<ethers.BigNumber>;
    /**
     * encoded calldata for given steps
     */
    callData: string;
  },
  txnType: 'claim' | 'plant',
}

export type ClaimPlantActionMap = {
  [action in ClaimPlantAction]: (...params: (Partial<ClaimPlantActionParams[action]>)[]) => ClaimPlantActionData 
}

export type ClaimPlantActionDataMap = Partial<{ [action in ClaimPlantAction]: ClaimPlantActionData }>;

type ClaimBeansParams<T extends Record<string, unknown>> = {
  amount?: TokenValue;
  toMode?: FarmToMode;
} & T;

type ClaimPlantActionParams = {
  [ClaimPlantAction.HARVEST]: ClaimBeansParams<{ plotIds: string[] }>;
  [ClaimPlantAction.CLAIM]: ClaimBeansParams<{ seasons: string[] }>;
  [ClaimPlantAction.RINSE]: ClaimBeansParams<{ tokenIds: string[] }>;
  [ClaimPlantAction.MOW]: { account: string };
  [ClaimPlantAction.PLANT]: {};
  [ClaimPlantAction.ENROOT]: { crates: { [addr: string]: DepositCrate[] } };
}

type ClaimPlantFunctions<T extends ClaimPlantAction> = (
  sdk: BeanstalkSDK, ...parameters: (ClaimPlantActionParams[T])[]
) => ClaimPlantActionData;

const harvest: ClaimPlantFunctions<ClaimPlantAction.HARVEST> = (sdk, { plotIds, amount, toMode }) => {
  const { beanstalk } = sdk.contracts;
  const callData = beanstalk.interface.encodeFunctionData('harvest', [
    plotIds,
    toMode || FarmToMode.INTERNAL,
  ]);

  return {
    txn: {
      callData,
      steps: [
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'harvest',
          amountOut: amount?.toBigNumber() || _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData,
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('harvest', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('harvest', result),
        })
      ],
      estimateGas: () => beanstalk.estimateGas.harvest(plotIds, toMode || FarmToMode.INTERNAL)
    },
    txnType: 'claim',
  };
};

const claim: ClaimPlantFunctions<ClaimPlantAction.CLAIM> = (sdk, { seasons, amount, toMode }) => {
  const { beanstalk } = sdk.contracts;
  if (seasons.length === 0) {
    const callData = beanstalk.interface.encodeFunctionData('claimWithdrawal', [
      sdk.tokens.BEAN.address,
      seasons[0],
      toMode || FarmToMode.INTERNAL,
    ]);

    return {
      txn: {
        callData,
        steps: [
          async (_amountInStep: ethers.BigNumber, _context: any) => ({
            name: 'claimWithdrawal',
            amountOut: amount?.toBigNumber() || _amountInStep,
            prepare: () => ({
              target: beanstalk.address,
              callData
            }),
            decode: (data: string) => beanstalk.interface.decodeFunctionData('claimWithdrawal', data),
            decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimWithdrawal', result),
          }),
        ],
        estimateGas: () => beanstalk.estimateGas.claimWithdrawal(sdk.tokens.BEAN.address, seasons[0], toMode || FarmToMode.INTERNAL)
      },
      txnType: 'claim',
    };
  }

  return {
    txn: {
      callData: beanstalk.interface.encodeFunctionData('claimWithdrawals', [
        sdk.tokens.BEAN.address,
        seasons,
        toMode || FarmToMode.INTERNAL,
      ]),
      steps: [
        new sdk.farm.actions.ClaimWithdrawals(
          sdk.tokens.BEAN.address,
          seasons,
          toMode || FarmToMode.INTERNAL
        ),
      ],
      estimateGas: () => beanstalk.estimateGas.claimWithdrawals(sdk.tokens.BEAN.address, seasons, toMode || FarmToMode.INTERNAL)
    },
    txnType: 'claim',
  };
};

const rinse: ClaimPlantFunctions<ClaimPlantAction.RINSE> = (sdk, { tokenIds, amount, toMode }) => {
  const { beanstalk } = sdk.contracts;
  const callData = beanstalk.interface.encodeFunctionData('claimFertilized', [
    tokenIds,
    toMode || FarmToMode.INTERNAL,
  ]);
 
  return {
    txn: {
      callData,
      steps: [
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'claimFertilized',
          amountOut: amount?.toBigNumber() || _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('claimFertilized', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimFertilized', result),
        }),
      ],
      estimateGas: () => beanstalk.estimateGas.claimFertilized(tokenIds, toMode || FarmToMode.INTERNAL)
    },
    txnType: 'claim'
  };
};

const mow: ClaimPlantFunctions<ClaimPlantAction.MOW> = (sdk, { account }) => {
  const { beanstalk } = sdk.contracts;
  const callData = beanstalk.interface.encodeFunctionData('update', [
    account
  ]);

  return {
    txn: {
      callData,
      steps: [
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'update',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('update', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('update', result),
        }),
      ],
      estimateGas: () => beanstalk.estimateGas.update(account)
    }, 
    txnType: 'plant'
  };
};

const plant: ClaimPlantFunctions<ClaimPlantAction.PLANT> = (sdk) => {
  const { beanstalk } = sdk.contracts;
  const callData = beanstalk.interface.encodeFunctionData('plant', undefined);
  return {
    txn: {
      callData,
      steps: [
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'plant',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('plant', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('plant', result),
        }),
      ],
      estimateGas: () => beanstalk.estimateGas.plant()
    }, 
    txnType: 'plant'
  };
};

const enroot: ClaimPlantFunctions<ClaimPlantAction.ENROOT> = (sdk, { crates }) => {
  const { beanstalk } = sdk.contracts;
  const callData: string[] = []; 
  const steps: StepGenerator<BasicPreparedResult>[] = [];

  Array.from(sdk.tokens.unripeTokens).forEach((urToken) => {
    const _crates = crates[urToken.address];
    if (_crates.length === 1) {
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposit', [
        urToken.address,
        _crates[0].season.toString(),
        urToken.fromHuman(_crates[0].amount.toString()).blockchainString,
      ]);
      
      steps.push(
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'enrootDeposit',
          amountOut: _amountInStep,
          prepare: () => ({ target: beanstalk.address, callData: encoded }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposit', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
        })
      );
      
      callData.push(encoded);
    } else if (_crates.length > 1) {
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposits', [
        urToken.address,
        _crates.map((crate) => crate.season.toString()),
        _crates.map((crate) => urToken.fromHuman(crate.amount.toString()).blockchainString)
      ]);
      
      steps.push(
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'enrootDeposits',
          amountOut: _amountInStep,
          prepare: () => ({ target: beanstalk.address, callData: encoded }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposits', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposits', result)
        })
      );

      callData.push(encoded);
    }
  });

  return {
    txn: {
      callData: callData.join(''),
      steps: steps,
      estimateGas: () => beanstalk.estimateGas.farm([
        ...callData
      ])
    },
    txnType: 'plant'
  };
};

export const claimPlantActionFunctions = {
  [ClaimPlantAction.RINSE]: rinse,
  [ClaimPlantAction.HARVEST]: harvest,
  [ClaimPlantAction.CLAIM]: claim,
  [ClaimPlantAction.MOW]: mow,
  [ClaimPlantAction.PLANT]: plant,
  [ClaimPlantAction.ENROOT]: enroot,
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

export function buildClaimPlantWithFarm(
  /** sdk */
  workflow: FarmWorkflow,
  /** 
   * the actions that must come before the steps in provided workflow are executed  
   */
  primaryActions: ClaimPlantActionDataMap,
  /** 
   * the actions in which order is not important
   */
  _secondaryActions: ClaimPlantActionDataMap,
  /** 
   * the workflow to be executed after the primary actions
   */
  operation: FarmWorkflow | StepGenerator<BasicPreparedResult>[],
  /**
   * the amount to be inputed when executing the workflow
   */
  amountIn: TokenValue,
) {
  // If the same action exists in both primary and secondary, we use the one in primary
  const set = new Set<ClaimPlantAction>();
  Object.keys(_secondaryActions).forEach((key) => set.add(key as ClaimPlantAction));
  Object.keys(primaryActions).forEach((key) => set.delete(key as ClaimPlantAction));

  const secondaryActions = [...set].reduce<ClaimPlantActionDataMap>((prev, curr) => {
    prev[curr] = _secondaryActions[curr];
    return prev;
  }, {});

   /**
   * Make sure that if we are calling 'enroot' or 'plant', we are not also calling mow.
   * 'Mow' is executed by default if enrooting or planting on the contract side.
   */
   const enrooting = ClaimPlantAction.ENROOT in primaryActions || ClaimPlantAction.ENROOT in secondaryActions;
   const planting = ClaimPlantAction.PLANT in primaryActions || ClaimPlantAction.PLANT in secondaryActions;

  if (enrooting || planting) {
    if (ClaimPlantAction.MOW in primaryActions) delete primaryActions[ClaimPlantAction.MOW];
    if (ClaimPlantAction.MOW in secondaryActions) delete secondaryActions[ClaimPlantAction.MOW];
  }

  Object.values(primaryActions).forEach(({ txn }) => {
    workflow.add([...txn.steps]);
  });

  workflow.add(injectOnlyLocal('pre-x', amountIn), { onlyLocal: true });

  if (operation instanceof FarmWorkflow) {
    workflow.add([...operation.generators]);
  } else {
    workflow.add([...operation]);
  }

  Object.values(secondaryActions).forEach(({ txn }) => { 
    workflow.add([...txn.steps]);
  });

  return workflow;
}

// take in sdk as a param to allow for testing
export default function useFarmerClaimAndPlantActions(sdk: BeanstalkSDK) {
  /// Farmer
  const account = useAccount();

  /// Farmer data
  const farmerSilo = useFarmerSilo();
  const farmerField = useFarmerField();
  const farmerBarn = useFarmerFertilizer();

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
      [ClaimPlantAction.MOW]: (params) => mow(sdk, { account, ...params }),
      [ClaimPlantAction.PLANT]: (_params) => plant(sdk),
      [ClaimPlantAction.ENROOT]: (params) => enroot(sdk, { crates: cratesForEnroot, ...params }),
      [ClaimPlantAction.CLAIM]: (params) => claim(sdk, { seasons: crates.map((crate) => crate.season.toString()), ...params }),
      [ClaimPlantAction.HARVEST]: (params) => harvest(sdk, { plotIds: plotIds, ...params }),
      [ClaimPlantAction.RINSE]: (params) => rinse(sdk, { tokenIds: fertilizerIds, ...params }),
    };
  }, [account, cratesForEnroot, farmerBarn.balances, farmerField.harvestablePlots, farmerSilo.balances, sdk]);

  // reduce an array of actions to a map of the actions for each step
  const toActionMap = useCallback((actions: ClaimPlantAction[]) => 
    actions.reduce<ClaimPlantActionDataMap>((prev, curr) => {
      prev[curr] = claimAndPlantActions[curr]();
      return prev;
    }, {}), 
    [claimAndPlantActions]
  );

  return { 
    actions: claimAndPlantActions,
    toActionMap,
    isClaimAction,
    isPlantAction,
    injectOnlyLocal,
    buildWorkflow: buildClaimPlantWithFarm,
  };
}
