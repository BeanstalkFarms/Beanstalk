import { BigNumberish, BigNumber, ethers } from "ethers";
import { RunContext, RunMode, StepClass, Workflow } from "src/classes/Workflow";
import { Token } from "src/classes/Token";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "../types";
import { deadlineSecondsToBlockchain } from "src/utils";
import { TokenValue } from "@beanstalk/sdk-core";

export class UniswapV3Swap extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "uniswapV3Swap";
  private transactionDeadline: BigNumberish;

  constructor(
    public readonly tokenIn: Token,
    public readonly tokenOut: Token,
    public readonly recipient: string,
    public readonly deadline?: number,
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
    const reversed = context.runMode === RunMode.EstimateReversed;

    const quoter = UniswapV3Swap.sdk.contracts.uniswapV3QuoterV2;
    
    let estimate: any;
    if (reversed) {
        estimate = await quoter.callStatic.quoteExactOutputSingle({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amount: _amountInStep,
            fee: 500,
            sqrtPriceLimitX96: 0,
        });
    } else {
        estimate = await quoter.callStatic.quoteExactInputSingle({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: _amountInStep,
            fee: 500,
            sqrtPriceLimitX96: 0,
        });
    };


    return {
      name: this.name,
      amountOut: estimate[0],
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("Exchange: slippage required");
        const minAmountOut = Workflow.slip(estimate[0], context.data.slippage);
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
            sqrtPriceLimitX96: 0
          }])
        };
      },
      decode: (data: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionData("exactInputSingle", data),
      decodeResult: (result: string) => UniswapV3Swap.sdk.contracts.uniswapV3Router.interface.decodeFunctionResult("exactInputSingle", result)
    };
  }
}
