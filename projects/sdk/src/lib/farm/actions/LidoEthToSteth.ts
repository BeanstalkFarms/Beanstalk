import { BigNumber } from "ethers";
import { RunContext, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { Clipboard } from "src/lib/depot";

export class LidoEthToSteth extends StepClass<AdvancedPipePreparedResult> {
  public name: "lidoEthToSteth";

  constructor() {
    super();
  }

  async run(amountInStep: BigNumber, _context: RunContext) {
    return {
      name: this.name,
      amountOut: amountInStep,
      prepare: () => {
        LidoEthToSteth.sdk.debug(`[${this.name}.encode()]`, {
          amount: amountInStep
        });

        return {
          target: LidoEthToSteth.sdk.contracts.lido.steth.address,
          callData: LidoEthToSteth.sdk.contracts.lido.steth.interface.encodeFunctionData("submit", [
            Clipboard.encode([], amountInStep)
          ])
        };
      },
      decode: (data: string) =>
        LidoEthToSteth.sdk.contracts.lido.steth.interface.decodeFunctionData("submit", data),
      decodeResult: (result: string) =>
        LidoEthToSteth.sdk.contracts.lido.steth.interface.decodeFunctionResult("submit", result)
    };
  }
}
