import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { FarmToMode } from "src/lib/farm/types";

export class WithdrawDeposits extends StepClass<BasicPreparedResult> {
  public name: string = "withdrawDeposits";

  constructor(
    public readonly _tokenIn: string,
    public readonly _stems: ethers.BigNumberish[],
    public readonly _amounts: ethers.BigNumberish[],
    public readonly _toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    WithdrawDeposits.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      stems: this._stems,
      amounts: this._amounts
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        WithdrawDeposits.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          stems: this._stems,
          amounts: this._amounts
        });
        return {
          target: WithdrawDeposits.sdk.contracts.beanstalk.address,
          callData: WithdrawDeposits.sdk.contracts.beanstalk.interface.encodeFunctionData("withdrawDeposits", [
            this._tokenIn,
            this._stems,
            this._amounts,
            this._toMode
          ])
        };
      },
      decode: (data: string) => WithdrawDeposits.sdk.contracts.beanstalk.interface.decodeFunctionData("withdrawDeposits", data),
      decodeResult: (result: string) => WithdrawDeposits.sdk.contracts.beanstalk.interface.decodeFunctionResult("withdrawDeposits", result)
    };
  }
}
