import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class WithdrawDeposit extends StepClass<BasicPreparedResult> {
  public name: string = "withdrawDeposit";

  constructor(private _tokenIn: string, private _season: ethers.BigNumberish, private _amount: ethers.BigNumberish) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    WithdrawDeposit.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      seasons: this._season,
      amounts: this._amount
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        WithdrawDeposit.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          seasons: this._season,
          amounts: this._amount
        });
        return {
          target: WithdrawDeposit.sdk.contracts.beanstalk.address,
          callData: WithdrawDeposit.sdk.contracts.beanstalk.interface.encodeFunctionData("withdrawDeposit", [
            this._tokenIn, //
            this._season, //
            this._amount //
          ])
        };
      },
      decode: (data: string) => WithdrawDeposit.sdk.contracts.beanstalk.interface.decodeFunctionData("withdrawDeposit", data),
      decodeResult: (result: string) => WithdrawDeposit.sdk.contracts.beanstalk.interface.decodeFunctionResult("withdrawDeposit", result)
    };
  }
}
