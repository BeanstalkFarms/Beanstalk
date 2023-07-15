import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { FarmFromMode } from "../types";

export class UnwrapEth extends StepClass<BasicPreparedResult> {
  public name: string = "unwrapEth";

  constructor(public readonly fromMode: FarmFromMode = FarmFromMode.INTERNAL) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep, // amountInStep should be an amount of ETH.
      value: _amountInStep, // need to use this amount in the txn.
      prepare: () => {
        UnwrapEth.sdk.debug(`[${this.name}.encode()]`, { fromMode: this.fromMode, _amountInStep, context });
        return {
          target: UnwrapEth.sdk.contracts.beanstalk.address,
          callData: UnwrapEth.sdk.contracts.beanstalk.interface.encodeFunctionData("unwrapEth", [
            _amountInStep, // ignore minAmountOut since there is no slippage
            this.fromMode
          ])
        };
      },
      decode: (data: string) => UnwrapEth.sdk.contracts.beanstalk.interface.decodeFunctionData("unwrapEth", data),
      decodeResult: (result: string) => UnwrapEth.sdk.contracts.beanstalk.interface.decodeFunctionResult("unwrapEth", result)
    };
  }
}
