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
    public readonly deadline?: number,
    public clipboard?: ClipboardSettings
  ) {
    super();
    this.transactionDeadline = deadline ? deadlineSecondsToBlockchain(deadline) : TokenValue.MAX_UINT256.toBlockchain();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    const [tokenIn, tokenOut] = Workflow.direction(
      this.tokenIn,
      this.tokenOut,
      context.runMode !== RunMode.EstimateReversed // _forward
    );

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

    const estimate = await quoter.callStatic.quoteExactInputSingle({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: _amountInStep,
        fee: 500,
        sqrtPriceLimitX96: 0,
    });

    return {
      name: this.name,
      amountOut: estimate[0],
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("Exchange: slippage required");
        const minAmountOut = Workflow.slip(estimate[0], context.data.slippage);
        const sqrtPriceX96After = estimate[1];
        if (!minAmountOut) throw new Error("Exhange: missing minAmountOut");
        return {
          target: UniswapV3Swap.sdk.contracts.uniswapV3Router.address,
          callData: UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.encodeFunctionData("exactInputSingle", [{
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            fee: 500,
            recipient: this.recipient,
            deadline: this.transactionDeadline,
            amountIn: _amountInStep,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: sqrtPriceX96After
          }]),
          clipboard: this.clipboard ? Clipboard.encodeSlot(context.step.findTag(this.clipboard.tag), this.clipboard.copySlot, this.clipboard.pasteSlot) : undefined
        };
      },
      decode: (data: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionData("exactInputSingle", data),
      decodeResult: (result: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionResult("exactInputSingle", result)
    };
  }
}
