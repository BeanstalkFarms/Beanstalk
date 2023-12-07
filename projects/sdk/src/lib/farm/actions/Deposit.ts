import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { FarmFromMode, FarmToMode } from "../types";
import { Token } from "src/classes/Token";
import { Clipboard } from "src/lib/depot";
import { ClipboardSettings } from "src/types";

export class Deposit extends StepClass<BasicPreparedResult> {
  public name: string = "deposit";
  public clipboard?: ClipboardSettings;

  constructor(
    public readonly token: Token, 
    public readonly fromMode: FarmFromMode = FarmFromMode.INTERNAL_EXTERNAL, 
    clipboard?: ClipboardSettings
  ) {
    super();
    this.clipboard = clipboard;
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    // Checking if the user isn't directly depositing BEANETH
    const indirectBeanEth = this.token.symbol === "BEANETH" && context.step.index > 0;
    const beanEthClipboard = {
      tag: `deposit${context.step.index}Amount`, 
      copySlot: 6, 
      pasteSlot: 1
    };
    
    if (indirectBeanEth && !this.clipboard) this.clipboard = beanEthClipboard;

    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        Deposit.sdk.debug(`[${this.name}.prepare()]`, {
          token: this.token.symbol,
          amountInStep: _amountInStep,
          fromMode: this.fromMode,
          clipboard: this.clipboard,
          context
        });
        if (!_amountInStep) throw new Error("Deposit: Missing _amountInStep");
        return {
          target: Deposit.sdk.contracts.beanstalk.address,
          callData: Deposit.sdk.contracts.beanstalk.interface.encodeFunctionData("deposit", [
            this.token.address,
            _amountInStep,
            this.fromMode
          ]),
          clipboard: this.clipboard ? Clipboard.encodeSlot(context.step.findTag(this.clipboard.tag), this.clipboard.copySlot, this.clipboard.pasteSlot) : undefined
        };
      }, 
      decode: (data: string) => Deposit.sdk.contracts.beanstalk.interface.decodeFunctionData("deposit", data),
      decodeResult: (result: string) => Deposit.sdk.contracts.beanstalk.interface.decodeFunctionResult("deposit", result)
    };
  }
}
