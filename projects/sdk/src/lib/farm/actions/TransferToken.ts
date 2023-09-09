import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { FarmFromMode, FarmToMode } from "../types";
import { Clipboard } from "src/lib/depot";

export class TransferToken extends StepClass<BasicPreparedResult> {
  public name: string = "transferToken";
  public useClipboard?: boolean;

  constructor(
    public readonly _tokenIn: string,
    public readonly _recipient: string,
    public readonly _fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    public readonly _toMode: FarmToMode = FarmToMode.INTERNAL,
    useClipboard?: boolean
  ) {
    super();
    this.useClipboard = useClipboard;
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
          useClipboard: this.useClipboard
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
          clipboard: this.useClipboard ? Clipboard.encodeSlot(context.step.findTag("amountToDeposit"), 0, 2) : undefined
        };
      },
      decode: (data: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionData("transferToken", data),
      decodeResult: (result: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionResult("transferToken", result)
    };
  }
}
