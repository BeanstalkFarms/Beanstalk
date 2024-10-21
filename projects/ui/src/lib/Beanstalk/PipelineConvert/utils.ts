/* eslint-disable @typescript-eslint/no-use-before-define */

import { BasinWell, Deposit } from '@beanstalk/sdk';
import { TokenValue } from '@beanstalk/sdk-core';
import { ContractFunctionParameters } from 'viem';
import { chunkArray } from '~/util';

const MAX_PER_CALL = 20;

const BasinWellABI = [
  // get remove liquidity out
  {
    inputs: [{ internalType: 'uint256', name: 'lpAmountIn', type: 'uint256' }],
    name: 'getRemoveLiquidityOut',
    outputs: [
      { internalType: 'uint256[]', name: 'tokenAmountsOut', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // add liquidity out
  {
    inputs: [
      { internalType: 'uint256[]', name: 'tokenAmountsIn', type: 'uint256[]' },
    ],
    name: 'getAddLiquidityOut',
    outputs: [
      { internalType: 'uint256', name: 'lpAmountOut', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function constructAddLiquidityMulticall(
  well: BasinWell,
  amountsIn: TokenValue[][]
) {
  const contracts: ContractFunctionParameters<typeof BasinWellABI>[] = [];

  const address = well.address as `0x${string}`;

  amountsIn.forEach((amounts) => {
    contracts.push({
      address,
      abi: BasinWellABI,
      functionName: 'getAddLiquidityOut',
      args: [amounts.map((v) => BigInt(v.blockchainString))],
    });
  });

  return chunkArray(contracts, MAX_PER_CALL);
}

function constructRemoveLiquidityMulticall(
  well: BasinWell,
  deposits: Deposit<TokenValue>[]
) {
  const contracts: ContractFunctionParameters<typeof BasinWellABI>[] = [];

  const address = well.address as `0x${string}`;

  deposits.forEach((deposit) => {
    contracts.push({
      address,
      abi: BasinWellABI,
      functionName: 'getRemoveLiquidityOut',
      args: [BigInt(deposit.amount.blockchainString)],
    });
  });

  return chunkArray(contracts, MAX_PER_CALL);
}

const PipelineConvertUtils = {
  constructMulticall: {
    addLiquidity: constructAddLiquidityMulticall,
    removeLiquidityEqual: constructRemoveLiquidityMulticall,
  },
};

export default PipelineConvertUtils;
