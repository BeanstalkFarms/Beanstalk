import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { FarmFromMode } from "../types";
import { Clipboard } from "src/lib/depot";
import { ClipboardSettings } from "src/types";

export class UnwrapEth extends StepClass<BasicPreparedResult> {
  public name: string = "unwrapEth";

  constructor(public readonly fromMode: FarmFromMode = FarmFromMode.INTERNAL, public clipboard?: ClipboardSettings) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    if (!this.clipboard) {
      // If the action directly preceding this one is a BEAN -> WETH swap through Pipeline...
      if (context.steps[context.step.index - 1].name === "pipelineBeanWethSwap") {
        // We use clipboard...
        this.clipboard = {
          // Then find the correct tag in the tag map
          tag: Object.keys(context.tagMap).find(tag => context.tagMap[tag] === context.step.index - 1)!, 
          copySlot: 9, 
          pasteSlot: 0
        };
      };
    };
    return {
      name: this.name,
      amountOut: _amountInStep, // amountInStep should be an amount of ETH.
      prepare: () => {
        UnwrapEth.sdk.debug(`[${this.name}.encode()]`, { 
          fromMode: this.fromMode, 
          _amountInStep, 
          context, 
          clipboard: this.clipboard
        });
        return {
          target: UnwrapEth.sdk.contracts.beanstalk.address,
          callData: UnwrapEth.sdk.contracts.beanstalk.interface.encodeFunctionData("unwrapEth", [
            _amountInStep, // ignore minAmountOut since there is no slippage
            this.fromMode
          ]),
          clipboard: this.clipboard ? Clipboard.encodeSlot(context.step.findTag(this.clipboard.tag), this.clipboard.copySlot, this.clipboard.pasteSlot) : undefined
        };
      },
      decode: (data: string) => UnwrapEth.sdk.contracts.beanstalk.interface.decodeFunctionData("unwrapEth", data),
      decodeResult: (result: string) => UnwrapEth.sdk.contracts.beanstalk.interface.decodeFunctionResult("unwrapEth", result),
      };
  }
}
