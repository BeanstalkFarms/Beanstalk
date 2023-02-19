import {
  BeanstalkSDK,
  FarmToMode,
  TokenValue,
  StepGenerator,
  BasicPreparedResult,
  FarmWorkflow,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import useAccount from '~/hooks/ledger/useAccount';
import useBDV from './useBDV';
import useSdk from '../sdk';
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

export type ClaimPlantActions = {
  [action in ClaimPlantAction]: (...parameters: (Partial<ClaimPlantActionParams[action]>)[]) => ClaimPlantActionData 
}

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
      estimateGas: () => beanstalk.estimateGas.plant(undefined)
    }, 
    txnType: 'plant'
  };
};

const enroot: ClaimPlantFunctions<ClaimPlantAction.ENROOT> = (sdk, { crates }) => {
  const { beanstalk } = sdk.contracts;
  const callData: string[] = []; 
  let _callData: string;
  let hasMultipleCrates = false;

  Array.from(sdk.tokens.unripeTokens).forEach((urToken) => {
    const _crates = crates[urToken.address];
    if (_crates.length === 1) {
      _callData = beanstalk.interface.encodeFunctionData('enrootDeposit', [
        urToken.address,
        _crates[0].season.toString(),
        urToken.amount(_crates[0].amount.toString()).blockchainString,
      ]);
      callData.push(_callData);
    } else if (_crates.length > 1) {
      hasMultipleCrates = true;
      _callData = beanstalk.interface.encodeFunctionData('enrootDeposits', [
        urToken.address,
        _crates.map((crate) => crate.season.toString()),
        _crates.map((crate) => urToken.amount(crate.amount.toString()).blockchainString)
      ]);
      callData.push(_callData);
    }
  });
  _callData = callData.join('');

  const step = hasMultipleCrates 
    ? async (_amountInStep: ethers.BigNumber, _context: any) => ({
        name: 'enrootDeposits',
        amountOut: _amountInStep,
        prepare: () => ({ target: beanstalk.address, callData: _callData }),
        decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposits', data),
        decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposits', result)
      }) 
    : async (_amountInStep: ethers.BigNumber, _context: any) => ({
        name: 'enrootDeposit',
        amountOut: _amountInStep,
        prepare: () => ({ target: beanstalk.address, callData: _callData }),
        decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposit', data),
        decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
      });

  return {
    txn: {
      callData: _callData,
      steps: [step],
      estimateGas: () => beanstalk.estimateGas.farm([..._callData])
    },
    txnType: 'plant'
  };
};

// take in sdk as a param to allow for testing
export function useClaimAndPlantActions(sdk: BeanstalkSDK) {
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

  const claimAndPlantActions: { 
    [action in ClaimPlantAction]: (...parameters: (Partial<ClaimPlantActionParams[action]>)[]) => ClaimPlantActionData 
  } = useMemo(() => {
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

  const utils = useMemo(() => {
    const isClaimAction = (action: ClaimPlantAction) => {
      if (action === ClaimPlantAction.RINSE || action === ClaimPlantAction.HARVEST || action === ClaimPlantAction.CLAIM) {
        return true;
      }
      return false;
    };

    const isPlantAction = (action: ClaimPlantAction) => {
      if (action === ClaimPlantAction.PLANT || action === ClaimPlantAction.ENROOT || action === ClaimPlantAction.MOW) {
        return true;
      }
      return false;
    };

    const injectOnlyLocal = (name: string, amount: TokenValue) => 
      async () => ({
        name,
        amountOut: amount.toBigNumber(),
        prepare: () => ({ target: '', callData: '' }),
        decode: () => undefined,
        decodeResult: () => undefined,
      });

    return { 
      isClaimAction,
      isPlantAction,
      injectOnlyLocal,
    };
  }, []);

  return { 
    actions: claimAndPlantActions,
    ...utils
  };
}

export default function useFarmerClaimAndPlantActions() {
  const sdk = useSdk();

  return useClaimAndPlantActions(sdk);
}

export function useClaimAndPlantWorkflowBuilder() {

}

export function buildClaimPlantWithFarm<T>(
  sdk: BeanstalkSDK, 
  actions: { [action in ClaimPlantAction]: ClaimPlantActionData },
  workflow: FarmWorkflow,
  amountIn: TokenValue,
  workflowParams: T,
) {
  
}
