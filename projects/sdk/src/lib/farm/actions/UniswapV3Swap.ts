import { BigNumberish, ethers } from "ethers";
import { RunContext, RunMode, StepClass, Workflow } from "src/classes/Workflow";
import { Token } from "src/classes/Token";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { deadlineSecondsToBlockchain } from "src/utils";
import { TokenValue } from "@beanstalk/sdk-core";
import { Clipboard } from "src/lib/depot";
import { ClipboardSettings } from "src/types";

export class UniswapV3Swap extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "uniswapV3Swap";
  private transactionDeadline: BigNumberish;

  constructor(
    public readonly tokenIn: Token,
    public readonly tokenOut: Token,
    public readonly recipient: string,
    public readonly feeTier: number,
    public readonly deadline?: number,
    public clipboard?: ClipboardSettings
  ) {
    super();
    this.transactionDeadline = deadline ? deadlineSecondsToBlockchain(deadline) : TokenValue.MAX_UINT256.toBlockchain();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {

    if (!this.clipboard) {
      const pipelineBeanWethSwapIndex = context.steps.findIndex(step => step.name === "pipelineBeanWethSwap");
      // If the action before (happens when reverse estimating) or after this one is a BEAN -> WETH swap through Pipeline...
      if (pipelineBeanWethSwapIndex >= 0 && Math.abs(pipelineBeanWethSwapIndex - context.step.index) === 1) {
        // We use clipboard...
        this.clipboard = {
          // Then find the correct tag in the tag map
          tag: Object.keys(context.tagMap).find(tag => context.tagMap[tag] === pipelineBeanWethSwapIndex)!, 
          copySlot: 9, 
          pasteSlot: 5
        };
      };
    };

    const quoter = UniswapV3Swap.sdk.contracts.uniswapV3QuoterV2;
    const reversed = context.runMode === RunMode.EstimateReversed;
    let estimate: any;

    if (!reversed) {
      estimate = await quoter.callStatic.quoteExactInputSingle({
          tokenIn: this.tokenIn.address,
          tokenOut: this.tokenOut.address,
          amountIn: _amountInStep,
          fee: this.feeTier,
          sqrtPriceLimitX96: 0,
      });
    } else {
      estimate = await quoter.callStatic.quoteExactOutputSingle({
          tokenIn: this.tokenIn.address,
          tokenOut: this.tokenOut.address,
          amount: _amountInStep,
          fee: this.feeTier,
          sqrtPriceLimitX96: 0,
      });
    };

    const swapFunctionName = reversed ? "exactOutputSingle" : "exactInputSingle";

    return {
      name: this.name,
      amountOut: estimate[0],
      prepare: () => {

        if (context.data.slippage === undefined) throw new Error("Exchange: slippage required");
        let callData;
        const estimatedOutput = TokenValue.fromBlockchain(estimate[0].toString(), this.tokenOut.decimals);
        const sqrtPriceX96After = estimate[1];
        if (!reversed) {
          const minAmountOut = estimatedOutput.subSlippage(context.data.slippage);
          if (!minAmountOut) throw new Error("UniswapV3Swap: missing minAmountOut");
          callData = UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.encodeFunctionData("exactInputSingle", [{
              tokenIn: this.tokenIn.address,
              tokenOut: this.tokenOut.address,
              fee: this.feeTier,
              recipient: this.recipient,
              deadline: this.transactionDeadline,
              amountIn: _amountInStep,
              amountOutMinimum: minAmountOut.toBlockchain().toString(),
              sqrtPriceLimitX96: sqrtPriceX96After
            }]);
        } else {
          const maxAmountIn = estimatedOutput.addSlippage(context.data.slippage);
          if (!maxAmountIn) throw new Error("UniswapV3Swap: missing maxAmountOut");
          callData = UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.encodeFunctionData("exactOutputSingle", [{
              tokenIn: this.tokenIn.address,
              tokenOut: this.tokenOut.address,
              fee: this.feeTier,
              recipient: this.recipient,
              deadline: this.transactionDeadline,
              amountOut: _amountInStep,
              amountInMaximum: maxAmountIn.toBlockchain().toString(),
              sqrtPriceLimitX96: sqrtPriceX96After
            }]);
        };
        
        return {
          target: UniswapV3Swap.sdk.contracts.uniswapV3Router.address,
          callData: callData,
          clipboard: this.clipboard ? Clipboard.encodeSlot(context.step.findTag(this.clipboard.tag), this.clipboard.copySlot, this.clipboard.pasteSlot) : undefined
        };
      },
      decode: (data: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionData(swapFunctionName, data),
      // @ts-ignore
      decodeResult: (result: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionResult(swapFunctionName, result)
    };
  }
}
