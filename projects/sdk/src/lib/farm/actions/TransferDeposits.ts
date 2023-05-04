import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class TransferDeposits extends StepClass<BasicPreparedResult> {
  public name: string = "transferDeposits";

  constructor(
    private _signer: string,
    private _to: string,
    private _tokenIn: string,
    private _seasons: ethers.BigNumberish[],
    private _amounts: ethers.BigNumberish[]
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    TransferDeposits.sdk.debug(`[${this.name}.run()]`, {
      signer: this._signer,
      to: this._to,
      tokenIn: this._tokenIn,
      seasons: this._seasons,
      amounts: this._amounts
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        TransferDeposits.sdk.debug(`[${this.name}.encode()]`, {
          signer: this._signer,
          to: this._to,
          tokenIn: this._tokenIn,
          seasons: this._seasons,
          amounts: this._amounts
        });
        return {
          target: TransferDeposits.sdk.contracts.beanstalk.address,
          callData: TransferDeposits.sdk.contracts.beanstalk.interface.encodeFunctionData("transferDeposits", [
            this._signer, //
            this._to, //
            this._tokenIn, //
            this._seasons, //
            this._amounts //
          ])
        };
      },
      decode: (data: string) => TransferDeposits.sdk.contracts.beanstalk.interface.decodeFunctionData("transferDeposits", data),
      decodeResult: (result: string) => TransferDeposits.sdk.contracts.beanstalk.interface.decodeFunctionResult("transferDeposits", result)
    };
  }
}
