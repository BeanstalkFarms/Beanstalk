import { getAddress, hashTypedData, type Address, type Hex } from 'viem';

export const ARBITRUM_CHAIN_ID = 42_161;
export const RFF_SCHEMA_VERSION = '1';
export const BEAN_ADDRESS = getAddress(
  '0xBEA0005B8599265D41256905A9B3073D397812E4'
);
export const WSTETH_ADDRESS = getAddress(
  '0x5979D7b546E38E414F7E9822514be443A4800529'
);

export enum BalanceMode {
  EXTERNAL = 0,
  INTERNAL = 1,
}

export type RffSwapRequest = {
  requester: Address;
  recipient: Address;
  tokenIn: Address;
  tokenOut: Address;
  requestedAmountIn: bigint;
  minAmountOutAtRequestedIn: bigint;
  sourceMode: BalanceMode;
  destinationMode: BalanceMode;
  nonce: bigint;
  deadline: bigint;
};

export type CancelRffSwap = {
  requestId: Hex;
  deadline: bigint;
};

export const RFF_SWAP_REQUEST_TYPES = {
  RffSwapRequest: [
    { name: 'requester', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'requestedAmountIn', type: 'uint256' },
    { name: 'minAmountOutAtRequestedIn', type: 'uint256' },
    { name: 'sourceMode', type: 'uint8' },
    { name: 'destinationMode', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const CANCEL_RFF_SWAP_TYPES = {
  CancelRffSwap: [
    { name: 'requestId', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function rffDomain(safeAddress: Address) {
  return {
    name: 'Beanstalk RFF',
    version: RFF_SCHEMA_VERSION,
    chainId: ARBITRUM_CHAIN_ID,
    verifyingContract: getAddress(safeAddress),
  } as const;
}

export function buildRffSwapRequestTypedData(
  request: RffSwapRequest,
  safeAddress: Address
): {
  domain: ReturnType<typeof rffDomain>;
  types: typeof RFF_SWAP_REQUEST_TYPES;
  primaryType: 'RffSwapRequest';
  message: RffSwapRequest;
  digest: Hex;
} {
  const typedData = {
    domain: rffDomain(safeAddress),
    types: RFF_SWAP_REQUEST_TYPES,
    primaryType: 'RffSwapRequest' as const,
    message: request,
  };

  return {
    ...typedData,
    digest: hashTypedData(typedData),
  };
}

export function buildCancelRffSwapTypedData(
  cancellation: CancelRffSwap,
  safeAddress: Address
): {
  domain: ReturnType<typeof rffDomain>;
  types: typeof CANCEL_RFF_SWAP_TYPES;
  primaryType: 'CancelRffSwap';
  message: CancelRffSwap;
  digest: Hex;
} {
  const typedData = {
    domain: rffDomain(safeAddress),
    types: CANCEL_RFF_SWAP_TYPES,
    primaryType: 'CancelRffSwap' as const,
    message: cancellation,
  };

  return {
    ...typedData,
    digest: hashTypedData(typedData),
  };
}

export function minimumAmountOut(
  quotedAmountOut: bigint,
  slippageBps: number
): bigint {
  if (
    !Number.isSafeInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw new Error('Slippage must be between 0 and 100%');
  }
  return (quotedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function deadlineOneMonthFrom(nowSeconds: number): bigint {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error('Current time must be a non-negative integer');
  }
  return BigInt(nowSeconds + 30 * 24 * 60 * 60);
}
