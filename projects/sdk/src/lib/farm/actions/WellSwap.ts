import { TokenValue } from "@beanstalk/sdk-core";
import { BigNumberish, ethers } from "ethers";
import { Token } from "src/classes/Token";
import { RunContext, RunMode, Step, StepClass, Workflow } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { deadlineSecondsToBlockchain } from "src/utils";

export class WellSwap extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "wellSwap";
  private transactionDeadline: BigNumberish;

  constructor(public wellAddress: string, public fromToken: Token, public toToken: Token, public recipient: string, deadline?: number) {
    super();
    if (deadline !== null && deadline !== undefined && deadline <= 0) {
      throw new Error("Deadline must be greater than 0");
    }
    this.transactionDeadline = deadline ? deadlineSecondsToBlockchain(deadline) : TokenValue.MAX_UINT256.toBlockchain();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    const well = await WellSwap.sdk.wells.getWell(this.wellAddress, {});
    try {
      await well.getName();
    } catch (err) {}
    const reversed = context.runMode === RunMode.EstimateReversed;

    // Run estimate to calculate amountOut
    let estimate: TokenValue;

    if (reversed) {
      // estimate reverse
      estimate = await well.swapToQuote(this.fromToken, this.toToken, this.toToken.fromBlockchain(_amountInStep));
    } else {
      // estimate forward
      estimate = await well.swapFromQuote(this.fromToken, this.toToken, this.fromToken.fromBlockchain(_amountInStep));
    }

    const wellFunctionName = reversed ? "swapTo" : "swapFrom";

    return {
      name: this.name,
      amountOut: estimate.toBigNumber(),
      value: ethers.BigNumber.from(0),
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("WellSwap: slippage required");

        let callData: string;
        if (!reversed) {
          const minAmountOut = estimate.subSlippage(context.data.slippage);

          WellSwap.sdk.debug(`>[${this.name}.prepare()]`, {
            well: well.name,
            tokenIn: this.fromToken.symbol,
            tokenOut: this.toToken.symbol,
            amountIn: _amountInStep.toString(),
            amountInStep: _amountInStep.toString(),
            minAmountOut: minAmountOut.toBigNumber().toString(),
            reversed,
            method: "swapFrom",
            context
          });

          callData = well.contract.interface.encodeFunctionData("swapFrom", [
            this.fromToken.address,
            this.toToken.address,
            _amountInStep,
            minAmountOut.toBigNumber(),
            this.recipient,
            this.transactionDeadline
          ]);
        } else {
          const maxAmountIn = estimate.addSlippage(context.data.slippage);
          WellSwap.sdk.debug(`>[${this.name}.prepare()]`, {
            well: well.name,
            tokenIn: this.fromToken.symbol,
            tokenOut: this.toToken.symbol,
            maxAmountIn: maxAmountIn.toBlockchain().toString(),
            amountOut: _amountInStep.toString(),
            amountInStep: _amountInStep.toString(),
            reversed,
            method: "swapTo",
            context
          });

          callData = well.contract.interface.encodeFunctionData("swapTo", [
            this.fromToken.address,
            this.toToken.address,
            maxAmountIn.toBigNumber(),
            _amountInStep,
            this.recipient,
            this.transactionDeadline
          ]);
        }

        return {
          target: this.wellAddress,
          callData: callData
        };
      },
      decode: (data: string) => well.contract.interface.decodeFunctionData(wellFunctionName, data),
      // @ts-ignore
      decodeResult: (data: string) => well.contract.interface.decodeFunctionResult(wellFunctionName, data)
    };
  }
}
