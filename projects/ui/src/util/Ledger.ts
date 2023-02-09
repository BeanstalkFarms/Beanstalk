import { BigNumber as BNJS } from 'ethers';
import BigNumber from 'bignumber.js';
import type Token from '~/classes/Token';
import { ChainConstant, SupportedChainId } from '~/constants';
import { toTokenUnitsBN } from './Tokens';
import { ERROR_STRINGS } from '../constants/errors'

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
interface Error {
  error?: string,
  rawError?: string,
}

export const parseError = (error: any) => {

  const errorMessage: Error = {}

  const rawError = error.toString()

  errorMessage.rawError = rawError

  switch (error.code) {
    /// ethers
    case 'UNSUPPORTED_OPERATION':
    case 'CALL_EXCEPTION':
    case 'UNPREDICTABLE_GAS_LIMIT':
      errorMessage.error = `Error: ${error.reason}`;
      return errorMessage;
    
    ///
    case -32603:
      if (error.data && error.data.message) {
        const matches = (error.data.message as string).match(/(["'])(?:(?=(\\?))\2.)*?\1/);
        const regExMatch = matches?.[0]?.replace(/^'(.+(?='$))'$/, '$1')
        if (regExMatch)
        {
          errorMessage.error = regExMatch
          return errorMessage
        }
        errorMessage.error = error.data.message
        return errorMessage
      }
      errorMessage.error = error.message.replace('execution reverted: ', '');
      return errorMessage
    
    /// MetaMask - RPC Error: MetaMask Tx Signature: User denied transaction signature.
    case 4001:
      errorMessage.error = 'You rejected the signature request.'
      return errorMessage

    /// Unknown
    default:

      for (const key in ERROR_STRINGS) {
        if (rawError.includes(key))
        {
          if (key == "CALL_EXCEPTION" && error.reason)
          {
            errorMessage.error = `Call Exception: ${error.reason}`
            return errorMessage
          }

          if (key == "UNPREDICTABLE_GAS_LIMIT" && error.reason)
          {
            errorMessage.error = `Unpredictable Gas Limit: ${error.reason}`
            return errorMessage
          }

          if (key == "TRANSACTION_REPLACED" && error.reason)
          {
            if (error.reason == "cancelled") {
              errorMessage.error = "Transaction cancelled."
              return errorMessage
            }
            if (error.reason == "replaced") {
              errorMessage.error = "Transaction replaced by one with a higher gas price."
              return errorMessage
            }
            if (error.reason == "repriced") {
              errorMessage.error = "Transaction repriced."
              return errorMessage
            }
          }

          if (key == "UNSUPPORTED_OPERATION" && error.reason)
          {
            errorMessage.error = `Unsupported Operation: ${error.reason}`
            return errorMessage
          }

          errorMessage.error = ERROR_STRINGS[key]
          return errorMessage
        }
      }

      errorMessage.error = "Unhandled error."
      return errorMessage
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
