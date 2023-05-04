import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class TransferDeposit extends StepClass<BasicPreparedResult> {
  public name: string = "transferDeposit";

  constructor(
    private _signer: string,
    private _to: string,
    private _tokenIn: string,
    private _season: ethers.BigNumberish,
    private _amount: ethers.BigNumberish
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    TransferDeposit.sdk.debug(`[${this.name}.run()]`, {
      signer: this._signer,
      to: this._to,
      tokenIn: this._tokenIn,
      season: this._season,
      amount: this._amount
    });
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
