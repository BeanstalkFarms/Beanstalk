export const ERROR_STRINGS: Record<string, any> = {
  // /////////////////
  // Blockchain Errors

  // This error indicates a transaction reverted.
  //  - transaction: the transaction
  //  - address?: the contract address
  //  - args?: The arguments passed into the function
  //  - method?: The Solidity method signature
  //  - errorSignature?: The EIP848 error signature
  //  - errorArgs?: The EIP848 error parameters
  //  - reason: The reason (only for EIP848 "Error(string)")
  CALL_EXCEPTION: "Call exception.",

  // Insufficient funds (< value + gasLimit * gasPrice)
  //   - transaction: the transaction attempted
  INSUFFICIENT_FUNDS: "Insufficient funds to complete the transaction.",

  // Nonce has already been used
  //   - transaction: the transaction attempted
  NONCE_EXPIRED: "Nonce has already been used.",

  // The replacement fee for the transaction is too low
  //   - transaction: the transaction attempted
  REPLACEMENT_UNDERPRICED: "Replacement fee for transaction is too low.",

  // The gas limit could not be estimated
  //   - transaction: the transaction passed to estimateGas
  UNPREDICTABLE_GAS_LIMIT: "Unpredictable gas limit.",

  // The transaction was replaced by one with a higher gas price
  //   - reason: "cancelled", "replaced" or "repriced"
  //   - cancelled: true if reason == "cancelled" or reason == "replaced")
  //   - hash: original transaction hash
  //   - replacement: the full TransactionsResponse for the replacement
  //   - receipt: the receipt of the replacement
  TRANSACTION_REPLACED: "Transaction replaced by one with a higher gas price.",

  // This Error indicates an ENS name was used, but the name has not
  // been configured.
  //
  // This could indicate an ENS name is unowned or that the current
  // address being pointed to is the Zero Address.
  //   - value: The ENS name that was requested
  UNCONFIGURED_NAME: "Unconfigured ENS name.",

  // A CCIP-read exception, which cannot be recovered from or
  // be further processed.
  //   - transaction?: the transaction
  //   - reason: the reason the CCIP-read failed.
  OFFCHAIN_FAULT: "Offchain fault.",

  // /////////////////
  // Operational Errors

  // This Error indicates an attempt was made to read outside the bounds
  // of protected data.
  //
  // Most operations in Ethers are protected by bounds checks, to mitigate
  // exploits when parsing data.
  //   - buffer: The buffer that was overrun.
  //   - length: The length of the buffer.
  //   - offset: The offset that was requested.
  BUFFER_OVERRUN: "Buffer overrun.",

  // This Error indicates an operation which would result in incorrect
  // arithmetic output has occurred.
  //
  // For example, trying to divide by zero or using a ``uint8`` to store
  // a negative value.
  //   - operation: the operation being executed
  //   - fault: the reason this faulted
  //   - value: the value the operation was attempted against.
  NUMERIC_FAULT: "Numeric fault.",

  // /////////////////
  // Argument Errors

  // This Error indicates an incorrect type or value was passed to
  // a function or method.
  //   - argument: the name of the argument.
  //   - value: the value that was provided.
  //   - info
  INVALID_ARGUMENT: "Invalid argument.",

  // This Error indicates there were too few arguments were provided.
  //   - count: the number of arguments received.
  //   - expectedCount: the number of arguments expected.
  MISSING_ARGUMENT: "Missing argument.",

  // This Error indicates too many arguments were provided.
  //   - count: the number of arguments received.
  //   - expectedCount: the number of arguments expected.
  UNEXPECTED_ARGUMENT: "Unexpected argument.",

  // /////////////////
  // Interaction Errors

  // The user rejected the action, such as signing a message or sending
  // a transaction
  ACTION_REJECTED: "You rejected the signature request.",

  // /////////////////
  // Generic Errors

  // This Error is a catch-all for when there is no way for Ethers to
  // know what the underlying problem is.
  UNKNOWN_ERROR: "Unknown error.",

  // This Error is mostly used as a stub for functionality that is
  // intended for the future, but is currently not implemented.
  NOT_IMPLEMENTED: "Not implemented.",

  // This Error indicates that the attempted operation is not supported.
  //
  // This could range from a specifc JSON-RPC end-point not supporting
  // a feature to a specific configuration of an object prohibiting the
  // operation.
  //
  // For example, a Wallet with no connected Provider is unable
  // to send a transaction.
  UNSUPPORTED_OPERATION: "Unsupported operation.",

  // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
  //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
  NETWORK_ERROR: "Network error.",

  // This Error indicates there was a problem fetching a resource from
  // a server.
  SERVER_ERROR: "Server error.",

  // This Error indicates that the timeout duration has expired and
  // that the operation has been implicitly cancelled.
  //
  // The side-effect of the operation may still occur, as this
  // generally means a request has been sent and there has simply
  // been no response to indicate whether it was processed or not.
  TIMEOUT: "Operation timed out.",

  // This Error indicates that a provided set of data cannot
  // be correctly interpretted.
  BAD_DATA: "Bad data.",

  //  This Error indicates that the operation was cancelled by a
  //  programmatic call, for example to ``cancel()``.
  CANCELLED: "Cancelled.",

  // /////////////////
  // Other Errors

  // Execution reverted
  "execution reverted": "Execution reverted.",

  // "[ethjs-query] while formatting outputs from RPC" errors
  // Usually code -32000, -32003, -32603
  "gas required exceeds allowance": "Gas required exceeds allowance.",

  "max priority fee per gas higher than max fee per gas": "Max priority fee per gas higher than max fee per gas.",

  "max fee per gas less than block base fee": "Max fee per gas lower than block base fee."
};

export interface Error {
  message: string;
  rawError?: string;
}

export const parseError = (error: any): Error => {
  const errorMessage: Error = { message: "" };

  const rawError = JSON.stringify(error);

  /// JSON.stringify returns an empty object when given an Error object
  if (rawError === "{}") {
    errorMessage.message = `${error}`;
    errorMessage.message = errorMessage.message.replace("Error: ", "");
    return errorMessage;
  }

  switch (error.code) {
    /// Common error codes
    case -32000:
    case -32603:
    case "UNPREDICTABLE_GAS_LIMIT":
    case "UNSUPPORTED_OPERATION":
    case "CALL_EXCEPTION":
      if (error.reason) {
        errorMessage.message = error.reason.replace("execution reverted: ", "");
        return errorMessage;
      }

      if (error.data && error.data.message) {
        errorMessage.message = error.data.message.replace("execution reverted: ", "");
        return errorMessage;
      }

      if (error.message) {
        if (!error.message.includes("RPC '")) {
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
        errorMessage.message = "Unhandled error.";
        return errorMessage;
      }

      errorMessage.rawError = rawError;
      errorMessage.message = "Unhandled error.";
      return errorMessage;

    /// MetaMask - RPC Error: MetaMask Tx Signature: User denied transaction signature.
    case 4001:
    case "ACTION_REJECTED":
      errorMessage.message = "Rejected by user.";
      return errorMessage;

    /// Unknown Error (Ideally, we shouldn't be reaching this stage)
    default:
      // eslint-disable-next-line no-restricted-syntax
      for (const key in ERROR_STRINGS) {
        if (rawError.includes(key)) {
          if (key === "CALL_EXCEPTION" && error.reason) {
            errorMessage.message = `Call Exception: ${error.reason}`;
            return errorMessage;
          }

          if (key === "UNPREDICTABLE_GAS_LIMIT" && error.reason) {
            errorMessage.message = `Transaction Reverted: ${error.reason}`;
            return errorMessage;
          }

          if (key === "TRANSACTION_REPLACED" && error.reason) {
            if (error.reason === "cancelled") {
              errorMessage.message = "Transaction cancelled.";
              return errorMessage;
            }
            if (error.reason === "replaced") {
              errorMessage.message = "Transaction replaced by one with a higher gas price.";
              return errorMessage;
            }
            if (error.reason === "repriced") {
              errorMessage.message = "Transaction repriced.";
              return errorMessage;
            }
          }

          if (key === "UNSUPPORTED_OPERATION" && error.reason) {
            errorMessage.message = `Unsupported Operation: ${error.reason}`;
            return errorMessage;
          }

          errorMessage.rawError = rawError;
          errorMessage.message = ERROR_STRINGS[key];
          return errorMessage;
        }
      }

      errorMessage.rawError = rawError;
      errorMessage.message = "Unhandled error.";
      return errorMessage;
  }
};
