import { BigNumber as BNJS } from 'ethers';
import BigNumber from 'bignumber.js';
import type Token from '~/classes/Token';
import { ChainConstant, SupportedChainId } from '~/constants';
import { toTokenUnitsBN } from './Tokens';
import { ERROR_STRINGS } from '../constants/errors';

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
  message: string,
  rawError?: string,
}

export const parseError = (error: any) => {
  const errorMessage: Error = { message: '' };

  const rawError = JSON.stringify(error);

  if (rawError === '{}') {
    errorMessage.message = `${error}`;
    return errorMessage;
  }

  switch (error.code) {
    /// Common error codes
    case -32000:
    case -32603:
    case 'UNPREDICTABLE_GAS_LIMIT':
    case 'UNSUPPORTED_OPERATION':
    case 'CALL_EXCEPTION':

      if (error.reason) {
        errorMessage.message = error.reason.replace('execution reverted: ', '');
        return errorMessage;
      }
      
      if (error.data && error.data.message) {
        errorMessage.message = error.data.message.replace('execution reverted: ', '');
        return errorMessage;
      }

      if (error.message) {
        if (!error.message.includes("RPC '"))
        {
          errorMessage.message = `${error.message}.`;
          return errorMessage;
        }

        const fixedString = error.message.split("RPC '")[1].slice(0, -1);
        const nestedError = JSON.parse(fixedString);
        if (nestedError) {
          if (error.code === -32603) {
          errorMessage.message = `${nestedError.value.data.message}.`;
          return errorMessage;
          }
          errorMessage.message = `${nestedError.value.message}.`;
          return errorMessage;
        }

        errorMessage.rawError = rawError;
        errorMessage.message = 'Unhandled error.';
        return errorMessage;
      }

      errorMessage.rawError = rawError;
      errorMessage.message = 'Unhandled error.';
      return errorMessage;
    
    /// MetaMask - RPC Error: MetaMask Tx Signature: User denied transaction signature.
    case 4001:
    case 'ACTION_REJECTED':
      errorMessage.message = 'You rejected the signature request.';
      return errorMessage;

    /// Unknown Error (Ideally, we shouldn't be reaching this stage)
    default:

      for (const key in ERROR_STRINGS) {
        if (rawError.includes(key))
        {
          if (key === 'CALL_EXCEPTION' && error.reason)
          {
            errorMessage.message = `Call Exception: ${error.reason}`;
            return errorMessage;
          }

          if (key === 'UNPREDICTABLE_GAS_LIMIT' && error.reason)
          {
            errorMessage.message = `Transaction Reverted: ${error.reason}`;
            return errorMessage;
          }

          if (key === 'TRANSACTION_REPLACED' && error.reason)
          {
            if (error.reason === 'cancelled') {
              errorMessage.message = 'Transaction cancelled.';
              return errorMessage;
            }
            if (error.reason === 'replaced') {
              errorMessage.message = 'Transaction replaced by one with a higher gas price.';
              return errorMessage;
            }
            if (error.reason === 'repriced') {
              errorMessage.message = 'Transaction repriced.';
              return errorMessage;
            }
          }

          if (key === 'UNSUPPORTED_OPERATION' && error.reason)
          {
            errorMessage.message = `Unsupported Operation: ${error.reason}`;
            return errorMessage;
          }

          errorMessage.rawError = rawError;
          errorMessage.message = ERROR_STRINGS[key];
          return errorMessage;
        }
      }

      errorMessage.rawError = rawError;
      errorMessage.message = 'Unhandled error.';
      return errorMessage;
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
