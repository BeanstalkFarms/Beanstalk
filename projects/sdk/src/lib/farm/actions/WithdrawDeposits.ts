import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class WithdrawDeposits extends StepClass<BasicPreparedResult> {
  public name: string = "withdrawDeposits";

  constructor(private _tokenIn: string, private _seasons: ethers.BigNumberish[], private _amounts: ethers.BigNumberish[]) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    WithdrawDeposits.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      seasons: this._seasons,
      amounts: this._amounts
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        WithdrawDeposits.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          seasons: this._seasons,
          amounts: this._amounts
        });
        return {
          target: WithdrawDeposits.sdk.contracts.beanstalk.address,
          callData: WithdrawDeposits.sdk.contracts.beanstalk.interface.encodeFunctionData("withdrawDeposits", [
            this._tokenIn, //
            this._seasons, //
            this._amounts //
          ])
        };
      },
      decode: (data: string) => WithdrawDeposits.sdk.contracts.beanstalk.interface.decodeFunctionData("withdrawDeposits", data),
      decodeResult: (result: string) => WithdrawDeposits.sdk.contracts.beanstalk.interface.decodeFunctionResult("withdrawDeposits", result)
    };
  }
}
