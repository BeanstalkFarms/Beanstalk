import React from "react";
import { ContractReceipt, ContractTransaction } from "ethers";
import toast from "react-hot-toast";
import { parseError } from "src/utils/parseError";
import { ToastAlert } from "./ToastAlert";

type ToastMessages = {
  loading?: string;
  success?: string;
  error?: string;
};

/**
 * A lightweight wrapper around react-hot-toast
 * to minimize repetitive Toast code when issuing transactions.
 */
export default class TransactionToast {
  /** */
  messages: ToastMessages;

  /** */
  toastId: any;

  constructor(messages: ToastMessages) {
    this.messages = messages;
    this.toastId = toast.loading(<ToastAlert desc={this.messages.loading} />, {
      duration: Infinity
    });
  }

  /**
   * Shows a loading message with Etherscan txn link while
   * a transaction is confirming
   * @param response The ethers.ContractTransaction response
   */
  confirming(response: ContractTransaction) {
    toast.loading(<ToastAlert desc={this.messages.loading} hash={response.hash} id={this.toastId} />, {
      id: this.toastId,
      duration: Infinity
    });
  }

  /**
   * After a transaction confirms, show a success message
   * and set a timeout duration for the toast.
   * @param value The ethers.ContractReceipt confirming the txn.
   */
  success(value?: ContractReceipt) {
    toast.success(<ToastAlert desc={this.messages.success} hash={value?.transactionHash} id={this.toastId} />, {
      id: this.toastId,
      duration: 5000
    });
  }

  error(error: any) {
    const duration = Infinity;
    const msg = parseError(error);
    toast.error(<ToastAlert desc={this.messages.error} msg={msg.message} rawError={msg.rawError} id={this.toastId} />, {
      id: this.toastId,
      duration: duration
    });
    return msg;
  }
}
