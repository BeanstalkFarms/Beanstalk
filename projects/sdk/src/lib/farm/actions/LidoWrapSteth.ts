import { BigNumber, ethers } from "ethers";
import { RunContext, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { Clipboard } from "src/lib/depot";
import { ClipboardSettings } from "src/types";
import { TokenValue } from "@beanstalk/sdk-core";

export class LidoWrapSteth extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "lidoWrapSteth";

  constructor(public clipboard?: ClipboardSettings) {
    super();
  }

  async run(amountInStep: BigNumber, context: RunContext) {
    const wstethAmtOut = await this.getWstETHWithStETH(amountInStep);

    return {
      name: this.name,
      amountOut: wstethAmtOut.toBigNumber(),
      prepare: () => {
        LidoWrapSteth.sdk.debug(`[${this.name}.encode()]`, {
          amount: amountInStep
        });

        return {
          target: LidoWrapSteth.sdk.contracts.lido.wsteth.address,
          callData: LidoWrapSteth.sdk.contracts.lido.wsteth.interface.encodeFunctionData("wrap", [
            amountInStep
          ]),
          clipboard: this.clipboard
            ? Clipboard.encodeSlot(
                context.step.findTag(this.clipboard.tag),
                this.clipboard.copySlot,
                this.clipboard.pasteSlot
              )
            : undefined
        };
      },
      decode: (data: string) =>
        LidoWrapSteth.sdk.contracts.lido.wsteth.interface.decodeFunctionData("wrap", data),
      decodeResult: (result: string) =>
        LidoWrapSteth.sdk.contracts.lido.wsteth.interface.decodeFunctionResult("wrap", result)
    };
  }

  async getWstETHWithStETH(amountInStep: ethers.BigNumber): Promise<TokenValue> {
    const amount = await LidoWrapSteth.sdk.contracts.lido.wsteth.getWstETHByStETH(amountInStep);

    return LidoWrapSteth.sdk.tokens.WSTETH.fromBlockchain(amount);
  }
}
