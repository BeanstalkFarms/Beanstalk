import { BigNumber as BNJS } from 'ethers';
import BigNumber from 'bignumber.js';
import type Token from '~/classes/Token';
import { ChainConstant, SupportedChainId } from '~/constants';
import { toTokenUnitsBN } from './Tokens';

// -------------------------
// Chain Result Helpers
// -------------------------

export enum Source {
  SUBGRAPH,
  LOCAL
}

// -------------------------
// Chain Result Helpers
// -------------------------

export const identityResult = (result: any) => result;

// FIXME: `instanceof BNJS` call; is this faster than always calling `.toString()`?
export const bigNumberResult = (result: any) => new BigNumber(result instanceof BNJS ? result.toString() : result);

export const tokenResult = (_token: Token | ChainConstant<Token>) => {
  // If a mapping is provided, default to MAINNET decimals.
  // ASSUMPTION: the number of decimals are the same across all chains.
  const token = (_token as Token).decimals 
    ? (_token as Token)
    : (_token as ChainConstant<Token>)[SupportedChainId.MAINNET];
  return (result: any) => toTokenUnitsBN(
    bigNumberResult(result),
    token.decimals
  );
};

/**
 * Return a formatted error string from a transaction error thrown by ethers.
 * @FIXME improve parsing
 */
export const parseError = (error: any) => {
  switch (error.code) {
    /// ethers
    case 'UNSUPPORTED_OPERATION':
    case 'CALL_EXCEPTION':
    case 'UNPREDICTABLE_GAS_LIMIT':
      return `Error: ${error.reason}`;
    
    ///
    case -32603:
      if (error.data && error.data.message) {
        const matches = (error.data.message as string).match(/(["'])(?:(?=(\\?))\2.)*?\1/);
        return matches?.[0]?.replace(/^'(.+(?='$))'$/, '$1') || error.data.message;
      }
      return error.message.replace('execution reverted: ', '');
    
    /// MetaMask - RPC Error: MetaMask Tx Signature: User denied transaction signature.
    case 4001:
      return 'You rejected the signature request.';

    /// Unknown
    default:
      if (error?.message) return `${error?.message || error?.toString()}.${error?.code ? ` (code=${error?.code})` : ''}`;    
      return `An unknown error occurred.${error?.code ? ` (code=${error?.code})` : ''}`;
  }
};

/**
 * Recursively parse all instances of BNJS as BigNumber
 * @unused
 */
 export const bn = (v: any) => (v instanceof BNJS ? new BigNumber(v.toString()) : false);
 export const parseBNJS = (_o: { [key: string]: any }) => {
   const o: { [key: string]: any } = {};
   Object.keys(_o).forEach((k: string) => {
     o[k] =
       bn(_o[k]) ||
       (Array.isArray(_o[k]) ? _o[k].map((v: any) => bn(v) || v) : _o[k]);
   });
   return o;
 };
