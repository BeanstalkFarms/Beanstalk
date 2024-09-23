import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { MinimumViableSwapQuote } from "src/lib/matcha";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { ERC20Token } from "src/classes/Token";
import { BigNumber, ethers } from "ethers";
import { BasinWell } from "src/classes/Pool/BasinWell";

export class PipelineConvert {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    PipelineConvert.sdk = sdk;
  }

  ///// Remove Equal 2 Add Equal
  // 1. Remove in equal parts from Well 1
  // 2. Swap non-bean token of well 1 for non-bean token of well 2
  // 3. Add in equal parts to well 2

  /**
   * Preforms a Remove Equal 2 Add Equal pipeline convert
   * @param tokenIn
   * @param stems
   * @param amounts
   * @param tokenOut
   * @param advPipeCalls
   * @param overrides
   * @returns
   */
  async removeEqualAddEqual(
    tokenIn: ERC20Token,
    stems: BigNumber[],
    amounts: BigNumber[],
    tokenOut: ERC20Token,
    advPipeCalls: AdvancedPipeCallStruct[],
    overrides?: ethers.PayableOverrides
  ) {
    return PipelineConvert.sdk.contracts.beanstalk.pipelineConvert(
      tokenIn.address,
      stems,
      amounts,
      tokenOut.address,
      advPipeCalls,
      overrides
    );
  }

  /**
   * Estimates the result of a Remove Equal 2 Add Equal pipeline convert
   * @param sourceWell Well to remove liquidity from
   * @param targetWell Well to add liquidity to
   * @param amountIn Amount of sourceWell.lpToken to remove
   * @param slippage Slippage tolerance for swap
   */
  async removeEqual2AddEqualQuote(
    sourceWell: BasinWell,
    targetWell: BasinWell,
    amountIn: TokenValue,
    swapSlippage: number
  ): Promise<{
    fromWellAmountsOut: TokenValue[];
    toWellAmountsIn: TokenValue[];
    quote: MinimumViableSwapQuote;
    amountOut: TokenValue;
    advPipeCalls: AdvancedPipeCallStruct[];
  }> {
    if (!PipelineConvert.sdk.pools.whitelistedPools.has(sourceWell.address)) {
      throw new Error(`${sourceWell.name} is not a whitelisted well`);
    }
    if (!PipelineConvert.sdk.pools.whitelistedPools.has(targetWell.address)) {
      throw new Error(`${targetWell.name} is not a whitelisted well`);
    }
    if (amountIn.lte(0)) {
      throw new Error("Cannot convert 0 or less tokens");
    }
    if (swapSlippage < 0) {
      throw new Error("Invalid slippage");
    }

    PipelineConvert.sdk.debug("[PipelineConvert] estimateRemoveEqual2AddEqual", {
      sourceWell: sourceWell,
      targetWell: targetWell,
      amountIn: amountIn.toHuman(),
      swapSlippage
    });

    const sourceIndexes = sourceWell.getBeanWellTokenIndexes();
    const targetIndexes = targetWell.getBeanWellTokenIndexes();

    const removeAmountsOut = await sourceWell.getRemoveLiquidityOutEqual(amountIn);

    const sellToken = sourceWell.tokens[sourceIndexes.nonBean];
    const buyToken = targetWell.tokens[targetIndexes.nonBean];

    const sellAmount = removeAmountsOut[sourceIndexes.nonBean];
    const beanAmount = removeAmountsOut[sourceIndexes.bean];

    PipelineConvert.sdk.debug("[PipelineConvert] removeLiquidityQuote + Prepare swap quote", {
      removeAmountsOut,
      swap: {
        buyToken,
        sellToken,
        sellAmount,
        beanAmount
      }
    });

    const quote = await PipelineConvert.sdk.zeroX.fetchSwapQuote({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount.blockchainString,
      takerAddress: PipelineConvert.sdk.contracts.pipeline.address,
      shouldSellEntireBalance: true,
      skipValidation: true,
      slippagePercentage: swapSlippage.toString()
    });

    const buyAmount = buyToken.fromBlockchain(quote.buyAmount);

    const toWellAmountsIn = [beanAmount, buyAmount];
    if (targetIndexes.bean !== 0) {
      toWellAmountsIn.reverse();
    }

    const amountOut = await targetWell.getAddLiquidityOut(toWellAmountsIn);

    const advPipeCalls = this.buildRemoveEqual2AddEqualAdvancedPipe({
      source: {
        well: sourceWell,
        amountIn: amountIn,
        minAmountsOut: removeAmountsOut
      },
      swap: {
        buyToken: buyToken,
        sellToken: sellToken,
        quote: quote
      },
      target: {
        well: targetWell,
        amountOut
      }
    });

    const result = {
      fromWellAmountsOut: [beanAmount, sellAmount],
      toWellAmountsIn: toWellAmountsIn,
      quote,
      amountOut,
      advPipeCalls
    };

    PipelineConvert.sdk.debug("[PipelineConvert] Result: ", result);

    return result;
  }

  /**
   * Builds the advanced pipe calls for a Remove Equal 2 Add Equal pipeline convert
   */
  public buildRemoveEqual2AddEqualAdvancedPipe(params: {
    source: {
      well: BasinWell;
      amountIn: TokenValue;
      minAmountsOut: TokenValue[];
    };
    swap: {
      buyToken: ERC20Token;
      sellToken: ERC20Token;
      quote: MinimumViableSwapQuote;
    };
    target: {
      well: BasinWell;
      amountOut: TokenValue;
    };
  }) {
    const { source, swap, target } = params;

    const sellTokenIndex = source.well.tokens.findIndex(
      (t) => t.address.toLowerCase() === swap.sellToken.address.toLowerCase()
    );

    const pipe: AdvancedPipeCallStruct[] = [];

    // 0: approve from.well.lpToken to use from.well.lpToken
    pipe.push(
      PipelineConvert.snippets.erc20Approve(source.well.lpToken, source.well.lpToken.address)
    );

    // 1: remove liquidity from from.well
    pipe.push(
      PipelineConvert.snippets.removeLiquidity(
        source.well,
        source.amountIn,
        source.minAmountsOut,
        PipelineConvert.sdk.contracts.pipeline.address
      )
    );

    // 2: Approve swap contract to spend sellToken
    pipe.push(PipelineConvert.snippets.erc20Approve(swap.sellToken, swap.quote.allowanceTarget));

    // 3: Swap non-bean token of well 1 for non-bean token of well 2
    pipe.push({
      target: swap.quote.to,
      callData: swap.quote.data,
      clipboard: Clipboard.encode([])
    });

    // 4: transfer swap result to target well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        swap.buyToken,
        target.well.address,
        TokenValue.ZERO, // overriden w/ clipboard
        Clipboard.encodeSlot(3, 0, 1)
      )
    );

    // 5: transfer from from.well.tokens[non-bean index] to target well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        source.well.tokens[sellTokenIndex === 1 ? 0 : 1],
        target.well.address,
        TokenValue.MAX_UINT256, // overriden w/ clipboard
        Clipboard.encodeSlot(1, 2, 1)
      )
    );

    // 6. Call Sync on target well
    pipe.push(
      PipelineConvert.snippets.wellSync(
        target.well,
        PipelineConvert.sdk.contracts.pipeline.address, // set recipient to pipeline
        target.amountOut // min LP Out
      )
    );

    return pipe;
  }

  // ---------- static methods ----------
  private static snippets = {
    // ERC20 Token Methods
    erc20Approve: (
      token: ERC20Token,
      spender: string,
      amount: TokenValue = TokenValue.MAX_UINT256,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct => {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("approve", [spender, amount.toBigNumber()]),
        clipboard
      };
    },
    erc20Transfer: (
      token: ERC20Token,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct => {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("transfer", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    // // Well Methods
    removeLiquidity: (
      well: BasinWell,
      amountIn: TokenValue,
      minAmountsOut: TokenValue[],
      recipient: string,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct => {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("removeLiquidity", [
            amountIn.toBigNumber(),
            minAmountsOut.map((v) => v.toBigNumber()),
            recipient,
            ethers.constants.MaxUint256
          ]),
        clipboard: clipboard
      };
    },
    wellSync: (
      well: BasinWell,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct => {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("sync", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    // Junction methods
    gte: (
      value: TokenValue,
      compareTo: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct => {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        // value >= compare
        callData: PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData("gte", [
          value.toBigNumber(),
          compareTo.toBigNumber()
        ]),
        clipboard
      };
    },
    check: (
      // index of the math or logic operation in the pipe
      index: number
    ): AdvancedPipeCallStruct => {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        callData: PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData("check", [
          false
        ]),
        clipboard: Clipboard.encodeSlot(index, 0, 0)
      };
    }
  };
}
