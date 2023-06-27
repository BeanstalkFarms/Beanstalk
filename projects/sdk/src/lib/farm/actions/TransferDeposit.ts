import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class TransferDeposit extends StepClass<BasicPreparedResult> {
  public name: string = "transferDeposit";

  constructor(
    public readonly _signer: string,
    public readonly _to: string,
    public readonly _tokenIn: string,
    public readonly _season: ethers.BigNumberish,
    public readonly _amount: ethers.BigNumberish
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        TransferDeposit.sdk.debug(`[${this.name}.encode()]`, {
          signer: this._signer,
          to: this._to,
          tokenIn: this._tokenIn,
          season: this._season,
          amount: this._amount
        });
        return {
          target: TransferDeposit.sdk.contracts.beanstalk.address,
          callData: TransferDeposit.sdk.contracts.beanstalk.interface.encodeFunctionData("transferDeposit", [
            this._signer, //
            this._to, //
            this._tokenIn, //
            this._season, //
            this._amount //
          ])
        };
      },
      decode: (data: string) => TransferDeposit.sdk.contracts.beanstalk.interface.decodeFunctionData("transferDeposit", data),
      decodeResult: (result: string) => TransferDeposit.sdk.contracts.beanstalk.interface.decodeFunctionResult("transferDeposit", result)
    };
  }
}
