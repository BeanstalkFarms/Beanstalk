import BigNumber from 'bignumber.js';

import Pool from '~/classes/Pool';
import Token from '~/classes/Token';

// --------------
// Utilities
// --------------

/* Diamonds */
export const NEW_BN  = new BigNumber(-1);
export const ZERO_BN = new BigNumber(0);
export const ONE_BN  = new BigNumber(1);
export const MAX_UINT32  = 4294967295;
export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// --------------
// Reusable types
// --------------

/** A Map of SupportedChainId => any arbitrary type */
export type ChainConstant<T> = { [chainId: number] : T };
/** A Map of address => any arbitrary type. */
export type AddressMap<T>    = { [address: string] : T };

// --------------------
// Token-specific types
// --------------------
// By default these assume a type parameter of Token,
// but this can be narrowed to ERC20Token, etc.

/** A Map of address => Token */
export type TokenMap<T = Token> = AddressMap<T>;

// -------------------
// Pool-specific types
// -------------------
// By default these assume a type parameter of Pool,
// but this can be narrowed.

/** A Map of address => Pool */
export type PoolMap<P = Pool> = AddressMap<P>;

// -------------------
// Re-exports
// -------------------
// We refrain from re-exporting `tokens.ts` and `pools.ts`
// to prevent circular dependency errors.

export * from './addresses';
export * from './blocks';
export * from './chaininfo';
export * from './chains';
export * from './ecosystem';
export * from './wallets';
export * from './links';
export * from './values';
export * from './rpc';
export * from './tooltips';
