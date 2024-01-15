import { TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { Token } from "src/classes/Token";
import { RunContext, RunMode, Step, StepClass, Workflow } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";

/**
 * Swap tokens in a Well by using the shift() method
 */
export class WellShift extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "shift";

  constructor(public wellAddress: string, public fromToken: Token, public toToken: Token, public recipient: string) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    const well = await WellShift.sdk.wells.getWell(this.wellAddress, {});

    try {
      await well.getName();
    } catch (err) {}

    const reversed = context.runMode === RunMode.EstimateReversed;

    if (reversed) {
      throw new Error("Reverse direction is not supported by shift()");
    }
    const estimate = await well.swapFromQuote(
      this.fromToken, 
      this.toToken, 
      TokenValue.fromBlockchain(_amountInStep.toString(), this.fromToken.decimals)
    );

    return {
      name: this.name,
      amountOut: estimate.toBigNumber(),
      value: ethers.BigNumber.from(0),
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("shift: slippage required");
        const minAmountOut = estimate.subSlippage(context.data.slippage);

        WellShift.sdk.debug(`>[${this.name}.prepare()]`, {
          well: well.name,
          tokenOut: this.toToken.symbol,
          amountIn: _amountInStep.toString(),
          minAmountOut: minAmountOut.toBigNumber().toString(),
          reversed,
          method: "shift",
          context
        });

        return {
          target: this.wellAddress,
          callData: well.contract.interface.encodeFunctionData("shift", [this.toToken.address, minAmountOut.toBigNumber(), this.recipient])
        };
      },
      decode: (data: string) => well.contract.interface.decodeFunctionData("shift", data),
      decodeResult: (data: string) => well.contract.interface.decodeFunctionResult("shift", data)
    };
  }
}
