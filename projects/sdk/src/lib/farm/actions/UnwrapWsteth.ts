import { TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { RunContext, Step, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { ClipboardSettings } from "src/types";

export class UnwrapWstETH extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "unwrapWstETH";
  public clipboard?: ClipboardSettings;

  constructor() {
    super();
  }

  async run(
    _amountInStep: ethers.BigNumber,
    context: RunContext
  ): Promise<Step<AdvancedPipePreparedResult>> {
    const amountOut = await this.getStethWithWsteth(_amountInStep);

    return {
      name: this.name,
      amountOut: amountOut.toBigNumber(),
      prepare: () => {
        UnwrapWstETH.sdk.debug(`[${this.name}.encode()]`, {
          amountOut: amountOut.toHuman(),
          clipboard: this.clipboard
        });

        return {
          target: UnwrapWstETH.sdk.contracts.lido.wsteth.address,
          callData: UnwrapWstETH.sdk.contracts.lido.wsteth.interface.encodeFunctionData("unwrap", [
            _amountInStep
          ])
        };
      },
      decode: (data: string) =>
        UnwrapWstETH.sdk.contracts.lido.wsteth.interface.decodeFunctionData("unwrap", data),
      decodeResult: (data: string) =>
        UnwrapWstETH.sdk.contracts.lido.wsteth.interface.decodeFunctionResult("unwrap", data)
    };
  }

  async getStethWithWsteth(amountInStep: ethers.BigNumber): Promise<TokenValue> {
    const amountOut = await UnwrapWstETH.sdk.contracts.lido.wsteth.getWstETHByStETH(amountInStep);

    return UnwrapWstETH.sdk.tokens.STETH.fromBlockchain(amountOut);
  }
}
