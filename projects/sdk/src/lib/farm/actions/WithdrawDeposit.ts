import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { FarmToMode } from "src/lib/farm/types";

export class WithdrawDeposit extends StepClass<BasicPreparedResult> {
  public name: string = "withdrawDeposit";

  constructor(
    public readonly _tokenIn: string,
    public readonly _stem: ethers.BigNumberish,
    public readonly _amount: ethers.BigNumberish,
    public readonly _toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    WithdrawDeposit.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      stem: this._stem,
      amount: this._amount
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        WithdrawDeposit.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          stem: this._stem,
          amount: this._amount
        });
        return {
          target: WithdrawDeposit.sdk.contracts.beanstalk.address,
          callData: WithdrawDeposit.sdk.contracts.beanstalk.interface.encodeFunctionData("withdrawDeposit", [
            this._tokenIn,
            this._stem,
            this._amount,
            this._toMode
          ])
        };
      },
      decode: (data: string) => WithdrawDeposit.sdk.contracts.beanstalk.interface.decodeFunctionData("withdrawDeposit", data),
      decodeResult: (result: string) => WithdrawDeposit.sdk.contracts.beanstalk.interface.decodeFunctionResult("withdrawDeposit", result)
    };
  }
}
