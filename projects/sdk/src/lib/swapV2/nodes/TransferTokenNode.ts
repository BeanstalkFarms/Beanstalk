import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token } from "src/classes/Token";
import { ISwapNodeSettable, SwapNode } from "./SwapNode";
import { StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { ClipboardSettings } from "src/types";
import { isNativeToken } from "src/utils/token";

interface TransferTokenBuildParams {
  fromMode: FarmFromMode;
  toMode: FarmToMode;
  recipient: string;
  copySlot: number | undefined;
}

export class TransferTokenNode extends SwapNode {
  readonly sellToken: ERC20Token;

  readonly buyToken: ERC20Token;

  readonly amountInPasteSlot = 2;

  readonly allowanceTarget = TransferTokenNode.sdk.contracts.beanstalk.address;

  constructor(sdk: BeanstalkSDK, sellToken: ERC20Token, buyToken: ERC20Token) {
    super(sdk);
    this.sellToken = sellToken;
    this.buyToken = buyToken;
  }

  override setFields<T extends ISwapNodeSettable>(args: Partial<T>) {
    const amount = args.sellAmount ?? args.buyAmount;
    if (amount) {
      this.sellAmount = amount;
      this.buyAmount = amount;
    }
    return this;
  }

  override buildStep({ 
    fromMode, 
    toMode, 
    recipient, 
    copySlot 
  }: TransferTokenBuildParams): StepClass<AdvancedPipePreparedResult> {
    let clipboard: ClipboardSettings | undefined;

    if (copySlot !== undefined) {
      clipboard = {
        tag: this.returnIndexTag,
        copySlot,
        pasteSlot: 0
      };
    }

    const transfer = new TransferTokenNode.sdk.farm.actions.TransferToken(
      this.sellToken.address,
      recipient,
      fromMode,
      toMode,
      clipboard
    );

    return transfer;
  }

  override validateTokens() {
    super.validateTokens();
    if (isNativeToken(this.sellToken)) {
      throw new Error("Invalid token transfer configuration. Sell Token cannot be a native token");
    } else if (isNativeToken(this.buyToken)) {
      throw new Error("Invalid token transfer configuration. Buy Token cannot be a native token");
    }
  }
}