import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";

export class Plant extends StepClass<BasicPreparedResult> {
  public name: string = "plant";

  constructor(
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        Plant.sdk.debug(`[${this.name}.encode()]`);
        return {
          target: Plant.sdk.contracts.beanstalk.address,
          callData: Plant.sdk.contracts.beanstalk.interface.encodeFunctionData("plant", undefined)
        };
      },
      decode: (data: string) => Plant.sdk.contracts.beanstalk.interface.decodeFunctionData("plant", data),
      decodeResult: (result: string) => Plant.sdk.contracts.beanstalk.interface.decodeFunctionResult("plant", result)
    };
  }
}
