// Workflow Action template
import { BigNumber, ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";

export class DevDebug extends StepClass<BasicPreparedResult> {
  public name: string = "devdebug";

  constructor(private message: string) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<BasicPreparedResult>> {
    DevDebug.sdk.debug(`>[${this.name}.run()]: ${this.message}`);
    return {
      name: this.name,
      amountOut: _amountInStep,
      value: BigNumber.from(0),
      prepare: () => {
        console.log(this.message);
        const callData = "0xDEVDEBUG";
        return {
          callData
        };
      },
      decode: (data: string) => [],
      decodeResult: (data: string) => []
    };
  }
}
