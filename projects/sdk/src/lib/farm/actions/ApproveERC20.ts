import { ethers } from "ethers";
import { ERC20Token } from "src/classes/Token";
import { RunContext, Step, StepClass } from "src/classes/Workflow";
import { Clipboard } from "src/lib/depot";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";

export class ApproveERC20 extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "approve";
  public token: ERC20Token;
  public spender: string;
  public useClipboard?: boolean;

  constructor(token: ERC20Token, spender: string, useClipboard?: boolean) {
    super();
    if (!token) throw new Error("ApproveERC20 action requires a token");
    if (!spender) throw new Error("ApproveERC20 action requires a spender");

    this.token = token;
    this.spender = spender;
    this.useClipboard = useClipboard;
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    return {
      name: this.name,
      amountOut: _amountInStep,
      value: ethers.BigNumber.from(0),
      prepare: () => {
        ApproveERC20.sdk.debug(`[${this.name}.encode()]`, {
          token: this.token,
          spender: this.spender,
          amountInStep: _amountInStep,
          useClipboard: this.useClipboard
        });
        return {
          target: this.token.address,
          callData: this.token.getContract().interface.encodeFunctionData("approve", [this.spender, _amountInStep]),
          clipboard: this.useClipboard ? Clipboard.encodeSlot(context.step.findTag("amountToDeposit"), 0, 1) : undefined
        };
      },
      decode: (data: string) => this.token.getContract().interface.decodeFunctionData("approve", data),
      decodeResult: (data: string) => this.token.getContract().interface.decodeFunctionResult("approve", data)
    };
  }
}
