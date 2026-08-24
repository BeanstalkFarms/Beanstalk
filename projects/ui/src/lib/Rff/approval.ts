import {
  encodeFunctionData,
  getAddress,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

import { BalanceMode } from './request';

export const BEANSTALK_ADDRESS = getAddress(
  '0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70'
);

export const ERC20_APPROVAL_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const INTERNAL_APPROVAL_ABI = parseAbi([
  'function approveToken(address spender, address token, uint256 amount)',
]);

export function buildApprovalCall(
  sourceMode: BalanceMode,
  token: Address,
  safeAddress: Address,
  requestedAmountIn: bigint
): { to: Address; data: Hex } {
  if (requestedAmountIn <= 0n) {
    throw new Error('Approval amount must be positive');
  }

  if (sourceMode === BalanceMode.EXTERNAL) {
    return {
      to: token,
      data: encodeFunctionData({
        abi: ERC20_APPROVAL_ABI,
        functionName: 'approve',
        args: [safeAddress, requestedAmountIn],
      }),
    };
  }

  if (sourceMode === BalanceMode.INTERNAL) {
    return {
      to: BEANSTALK_ADDRESS,
      data: encodeFunctionData({
        abi: INTERNAL_APPROVAL_ABI,
        functionName: 'approveToken',
        args: [safeAddress, token, requestedAmountIn],
      }),
    };
  }

  throw new Error('Unsupported RFF balance source');
}

export function adaptiveInputAmount(
  requestedAmountIn: bigint,
  allowance: bigint,
  selectedSourceBalance: bigint
): bigint {
  return [requestedAmountIn, allowance, selectedSourceBalance].reduce(
    (minimum, value) => (value < minimum ? value : minimum)
  );
}

export function isExactRffAllowance(
  allowance: bigint,
  requestedAmountIn: bigint
): boolean {
  return requestedAmountIn > 0n && allowance === requestedAmountIn;
}
