import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { FarmToMode } from "../types";

export class ClaimWithdrawal extends StepClass<BasicPreparedResult> {
  public name: string = "claimWithdrawal";

  constructor(private _tokenIn: string, private _seasons: ethers.BigNumberish, private _to: FarmToMode) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    ClaimWithdrawal.sdk.debug(`[${this.name}.run()]`, {
      tokenIn: this._tokenIn,
      seasons: this._seasons,
      to: this._to
    });
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        ClaimWithdrawal.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          seasons: this._seasons,
          to: this._to
        });
        return {
          target: ClaimWithdrawal.sdk.contracts.beanstalk.address,
          callData: ClaimWithdrawal.sdk.contracts.beanstalk.interface.encodeFunctionData("claimWithdrawal", [
            this._tokenIn, //
            this._seasons, //
            this._to
          ])
        };
      },
      decode: (data: string) => ClaimWithdrawal.sdk.contracts.beanstalk.interface.decodeFunctionData("claimWithdrawal", data),
      decodeResult: (result: string) => ClaimWithdrawal.sdk.contracts.beanstalk.interface.decodeFunctionResult("claimWithdrawal", result)
    };
  }
}
