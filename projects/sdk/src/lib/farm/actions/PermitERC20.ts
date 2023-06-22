import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { EIP2612PermitMessage, SignedPermit } from "src/lib/permit";

export class PermitERC20 extends StepClass<BasicPreparedResult> {
  public name: string = "attachPermitERC20";

  constructor(
    public readonly getPermit: string | SignedPermit<EIP2612PermitMessage> | ((context: RunContext) => any) = "permit" // any = permit
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep,
      value: ethers.BigNumber.from(0),
      prepare: () => {
        // PermitERC20.sdk.debug(`[${this.name}.prepare()]`, {});
        let permit: SignedPermit<EIP2612PermitMessage>;
        if (typeof this.getPermit === "string") {
          permit = context.data[this.getPermit];
        } else if (typeof this.getPermit === "function") {
          permit = this.getPermit(context);
        } else {
          permit = this.getPermit;
        }

        if (!permit /* || permitInvalid */) {
          throw new Error(
            `No permit${
              typeof this.getPermit === "string"
                ? `found at context.data[${this.getPermit}]`
                : typeof this.getPermit === "function"
                ? "returned from provided getPermit function"
                : "provided"
            }`
          );
        }

        return {
          target: PermitERC20.sdk.contracts.beanstalk.address,
          callData: PermitERC20.sdk.contracts.beanstalk.interface.encodeFunctionData("permitERC20", [
            permit.typedData.domain.verifyingContract, // token address
            permit.owner, // owner
            permit.typedData.message.spender, // spender
            permit.typedData.message.value, // value
            permit.typedData.message.deadline, // deadline
            permit.split.v,
            permit.split.r,
            permit.split.s
          ])
        };
      },
      decode: (data: string) => PermitERC20.sdk.contracts.beanstalk.interface.decodeFunctionData("permitERC20", data),
      decodeResult: (result: string) => PermitERC20.sdk.contracts.beanstalk.interface.decodeFunctionResult("permitERC20", result)
    };
  }
}
