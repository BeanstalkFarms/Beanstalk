import { ethers } from "ethers";
import { ERC20Token } from "src/classes/Token";
import { RunContext, Step, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";

export class ApproveERC20 extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "approve";
  public token: ERC20Token;
  public spender: string;

  constructor(token: ERC20Token, spender: string) {
    super();
    if (!token) throw new Error("ApproveERC20 action requires a token");
    if (!spender) throw new Error("ApproveERC20 action requires a spender");

    this.token = token;
    this.spender = spender;
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    return {
      name: this.name,
      amountOut: _amountInStep,
      value: ethers.BigNumber.from(0),
      prepare: () => {
        return {
          target: this.token.address,
          callData: this.token.getContract().interface.encodeFunctionData("approve", [this.spender, _amountInStep])
        };
      },
      decode: (data: string) => this.token.getContract().interface.decodeFunctionData("approve", data),
      decodeResult: (data: string) => this.token.getContract().interface.decodeFunctionResult("approve", data)
    };
  }
}
