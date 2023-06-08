import React from "react";
import { ContractReceipt, ContractTransaction } from "ethers";
import toast from "react-hot-toast";
import { parseError } from "src/utils/parseError";
import { ToastAlert } from "./ToastAlert";

type ToastMessages = {
  loading: string;
  success: string;
  error: string;
};

export class TransactionToast {
  messages: ToastMessages;
  toastId: any;

  constructor(messages: ToastMessages) {
    this.messages = messages;
    this.toastId = toast.loading(<ToastAlert desc={this.messages.loading} />);
  }

  confirming(response: ContractTransaction) {
    toast.loading(<ToastAlert desc={this.messages.loading} hash={response.hash} id={this.toastId} />, {
      id: this.toastId
    });
  }

  success(value?: ContractReceipt) {
    toast.success(<ToastAlert desc={this.messages.success} hash={value?.transactionHash} id={this.toastId} />, {
      id: this.toastId
    });
  }

  error(error: any) {
    const msg = parseError(error);
    toast.error(<ToastAlert desc={this.messages.error} msg={msg.message} rawError={msg.rawError} id={this.toastId} />, {
      id: this.toastId
    });
    return msg;
  }
}
