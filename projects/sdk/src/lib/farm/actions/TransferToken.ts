import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { FarmFromMode, FarmToMode } from "../types";
import { Clipboard } from "src/lib/depot";

export class TransferToken extends StepClass<BasicPreparedResult> {
  public name: string = "transferToken";
  public clipboard?: { tag: string, copySlot: number, pasteSlot: number };

  constructor(
    public readonly _tokenIn: string,
    public readonly _recipient: string,
    public readonly _fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    public readonly _toMode: FarmToMode = FarmToMode.INTERNAL,
    clipboard?: { tag: string, copySlot: number, pasteSlot: number }
  ) {
    super();
    this.clipboard = clipboard;
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep, // transfer exact amount
      prepare: () => {
        TransferToken.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          recipient: this._recipient,
          amountInStep: _amountInStep,
          fromMode: this._fromMode,
          toMode: this._toMode,
          clipboard: this.clipboard
        });
        return {
          target: TransferToken.sdk.contracts.beanstalk.address,
          callData: TransferToken.sdk.contracts.beanstalk.interface.encodeFunctionData("transferToken", [
            this._tokenIn, //
            this._recipient, //
            _amountInStep, // ignore minAmountOut since there is no slippage on transfer
            this._fromMode, //
            this._toMode //
          ]),
          clipboard: this.clipboard ? Clipboard.encodeSlot(context.step.findTag(this.clipboard.tag), this.clipboard.copySlot, this.clipboard.pasteSlot) : undefined
        };
      },
      decode: (data: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionData("transferToken", data),
      decodeResult: (result: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionResult("transferToken", result)
    };
  }
}
