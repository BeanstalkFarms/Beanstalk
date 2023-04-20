//@ts-nocheck

// Workflow Action template
import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";

export class ActionTemplate extends StepClass<BasicPreparedResult> {
  public name: string = "sample";

  constructor() {}

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<BasicPreparedResult>> {
    // sdk is accessible as a static property on this class, for ex, ActionTemplate.sdk
    return {
      name,
      amountOut,
      value,
      prepare: () => {
        return {
          target,
          callData,
          clipboard
        };
      },
      decode: (data: string) => [], //decodeFunctionData("unwrapEth", data),
      decodeResult: (data: string) => [] //decodeFunctionResult("unwrapEth", data),
    };
  }
}
