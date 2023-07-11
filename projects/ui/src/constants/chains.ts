import {
  ChainId as SupportedChainId,
  TESTNET_CHAINS,
} from '@beanstalk/sdk-core';

/**
 * Guide to adding a new chain:
 * 1. Pick a chainId and add to SupportedChainId
 * 2. Add to REPLANTED_CHAINS and TESTNET_CHAINS if appropriate
 * 3. If this is an unofficial testnet, add a RPC URL to TESTNET_RPC_ADDRESSES
 * 4. Add a chainInfo entry in subsequent constants
 * 5. If this contract uses a different ABI for some contracts, add those in `useContract`
 */

/**
 * List of supported chains
 */
export { SupportedChainId };

/**
 * These chains are forks of mainnet,
 * therefore they use the same token addresses as mainnet.
 */
export { TESTNET_CHAINS };

// ---------------------------------

export enum NetworkType {
  L1,
  L2,
}

export const L1_CHAIN_IDS = [
  SupportedChainId.MAINNET,
  SupportedChainId.LOCALHOST,
  SupportedChainId.TESTNET,
] as const;

export const L2_CHAIN_IDS = [] as const;

export type SupportedL1ChainId = typeof L1_CHAIN_IDS[number];
export type SupportedL2ChainId = typeof L2_CHAIN_IDS[number];

interface BaseChainInfo {
  readonly networkType: NetworkType;
  readonly blockWaitMsBeforeWarning?: number;
  readonly docs?: string;
  readonly bridge?: string;
  readonly explorer: string;
  readonly infoLink?: string;
  readonly logoUrl: string;
  readonly label: string;
  readonly helpCenterUrl?: string;
  readonly nativeCurrency: {
    name: string; // e.g. 'Goerli ETH',
    symbol: string; // e.g. 'gorETH',
    decimals: number; // e.g. 18,
  };
}

export interface L1ChainInfo extends BaseChainInfo {
  readonly networkType: NetworkType.L1;
}

export interface L2ChainInfo extends BaseChainInfo {
  readonly networkType: NetworkType.L2;
  readonly bridge: string;
  readonly statusPage?: string;
  readonly defaultListUrl: string;
}
