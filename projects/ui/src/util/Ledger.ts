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

      const errorString = error.toString()

      ///////////////////
      // Blockchain Errors

      // Call exception
      //  - transaction: the transaction
      //  - address?: the contract address
      //  - args?: The arguments passed into the function
      //  - method?: The Solidity method signature
      //  - errorSignature?: The EIP848 error signature
      //  - errorArgs?: The EIP848 error parameters
      //  - reason: The reason (only for EIP848 "Error(string)")
      if (errorString.includes("CALL_EXCEPTION")) {
        if (error.reason)
        {
          return `Call Exception: ${error.reason}`;
        }
        return "Call exception."
      }

      // Insufficient funds (< value + gasLimit * gasPrice)
      //   - transaction: the transaction attempted
      if (errorString.includes("INSUFFICIENT_FUNDS")) {
        return "Insufficient funds to complete the transaction."
      }

      // Nonce has already been used
      //   - transaction: the transaction attempted
      if (errorString.includes("NONCE_EXPIRED")) {
        return "Error: Nonce has already been used.";
      }

      // The replacement fee for the transaction is too low
      //   - transaction: the transaction attempted
      if (errorString.includes("REPLACEMENT_UNDERPRICED")) {
        return "Replacement fee for transaction is too low."
      }

      // The gas limit could not be estimated
      //   - transaction: the transaction passed to estimateGas
      if (errorString.includes("UNPREDICTABLE_GAS_LIMIT")) {
        if (error.reason)
        {
          return `Unpredictable Gas Limit: ${error.reason}`;
        }
        return "Unpredictable gas limit."
      }

      // The transaction was replaced by one with a higher gas price
      //   - reason: "cancelled", "replaced" or "repriced"
      //   - cancelled: true if reason == "cancelled" or reason == "replaced")
      //   - hash: original transaction hash
      //   - replacement: the full TransactionsResponse for the replacement
      //   - receipt: the receipt of the replacement
      if (errorString.includes("TRANSACTION_REPLACED")) {
        if (error.reason == "cancelled") {
          return "Transaction cancelled."
        }
        if (error.reason == "replaced") {
          return "Transaction replaced by one with a higher gas price."
        }
        if (error.reason == "repriced") {
          return "Transaction repriced."
        }
        return "Transaction replaced by one with a higher gas price."
      }

      ///////////////////
      // Interaction Errors

      // The user rejected the action, such as signing a message or sending
      // a transaction
      if (errorString.includes("ACTION_REJECTED")) {
        return "You rejected the signature request.";
      }

      if (errorString.includes("TRANSACTION_RAN_OUT_OF_GAS")) {
        return "Transaction ran out of gas.";
      }

      if (errorString.includes("TRANSACTION_UNDERPRICED")) {
        return "Transaction underpriced.";
      }

      if (errorString.includes("REJECTED_TRANSACTION")) {
        return "Transaction rejected.";
      }

      if (errorString.includes("CALL_REVERTED")) {
        return "Call reverted.";
      }

      if (errorString.includes("execution reverted")) {
        return "Execution reverted.";
      }

      if (errorString.includes("NONCE_TOO_LOW")) {
        return "Nonce too low.";
      }

      if (errorString.includes("INSUFFICIENT_FUNDS_FOR_GAS")) {
        return "Insufficient funds for gas.";
      }


      ///////////////////
      // "[ethjs-query] while formatting outputs from RPC" errors

      if (errorString.includes("gas required exceeds allowance")) {
        return "Gas required exceeds allowance.";
      }

      if (errorString.includes("max priority fee per gas higher than max fee per gas")) {
        return "Max priority fee per gas higher than max fee per gas.";
      }

      if (errorString.includes("max fee per gas less than block base fee")) {
        return "Max fee per gas lower than block base fee.";
      }

      ///////////////////
      // Operational Errors

      // Buffer Overrun
      if (errorString.includes("BUFFER_OVERRUN")) {
        return "Buffer overrun."
      }

      // Numeric Fault
      //   - operation: the operation being executed
      //   - fault: the reason this faulted
      if (errorString.includes("NUMERIC_FAULT")) {
        return "Numeric fault."
      }

      
      ///////////////////
      // Generic Errors

      // Unknown Error
      if (errorString.includes("UNKNOWN_ERROR")) {
        return "Unknown error.";
      }

      // Not Implemented
      if (errorString.includes("NOT_IMPLEMENTED")) {
        return "Not implemented."
      }

      // Unsupported Operation
      //   - operation
      if (errorString.includes("UNSUPPORTED_OPERATION")) {
        if (error.reason)
        {
          return `Unsupported Operation: ${error.reason}`
        }
        return "Unsupported operation."
      }

      // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
      //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
      if (errorString.includes("NETWORK_ERROR")) {
        return "Network error."
      }

      // Some sort of bad response from the server
      if (errorString.includes("SERVER_ERROR")) {
        return "Server error."
      }

      // Timeout
      if (errorString.includes("TIMEOUT")) {
        return "Operation timed out."
      }

      return "Unhandled error."
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
