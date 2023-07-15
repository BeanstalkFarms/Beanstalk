import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { FarmFromMode, FarmToMode } from "../types";

export class TransferToken extends StepClass<BasicPreparedResult> {
  public name: string = "transferToken";

  constructor(
    public readonly _tokenIn: string,
    public readonly _recipient: string,
    public readonly _fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    public readonly _toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
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
          toMode: this._toMode
        });
        return {
          target: TransferToken.sdk.contracts.beanstalk.address,
          callData: TransferToken.sdk.contracts.beanstalk.interface.encodeFunctionData("transferToken", [
            this._tokenIn, //
            this._recipient, //
            _amountInStep, // ignore minAmountOut since there is no slippage on transfer
            this._fromMode, //
            this._toMode //
          ])
        };
      },
      decode: (data: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionData("transferToken", data),
      decodeResult: (result: string) => TransferToken.sdk.contracts.beanstalk.interface.decodeFunctionResult("transferToken", result)
    };
  }
}
