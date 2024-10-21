import { TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { RunContext, Step, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { ClipboardSettings } from "src/types";

export class LidoUnwrapWstETH extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "lidoUnwrapWstETH";

  constructor(public clipboard?: ClipboardSettings) {
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
        LidoUnwrapWstETH.sdk.debug(`[${this.name}.encode()]`, {
          amountOut: amountOut.toHuman(),
          clipboard: this.clipboard
        });

        return {
          target: LidoUnwrapWstETH.sdk.contracts.lido.wsteth.address,
          callData: LidoUnwrapWstETH.sdk.contracts.lido.wsteth.interface.encodeFunctionData(
            "unwrap",
            [_amountInStep]
          )
        };
      },
      decode: (data: string) =>
        LidoUnwrapWstETH.sdk.contracts.lido.wsteth.interface.decodeFunctionData("unwrap", data),
      decodeResult: (data: string) =>
        LidoUnwrapWstETH.sdk.contracts.lido.wsteth.interface.decodeFunctionResult("unwrap", data)
    };
  }

  async getStethWithWsteth(amountInStep: ethers.BigNumber): Promise<TokenValue> {
    const amountOut =
      await LidoUnwrapWstETH.sdk.contracts.lido.wsteth.getWstETHByStETH(amountInStep);

    return LidoUnwrapWstETH.sdk.tokens.STETH.fromBlockchain(amountOut);
  }
}
