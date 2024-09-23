import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { MinimumViableSwapQuote } from "src/lib/matcha";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { ERC20Token } from "src/classes/Token";
import { ethers } from "ethers";
import { BasinWell } from "src/classes/Pool/BasinWell";

export class PipelineConvert {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    PipelineConvert.sdk = sdk;
  }

  public async estimateEqual2Equal(
    fromWell: BasinWell,
    toWell: BasinWell,
    amountIn: TokenValue,
    slippage: number
  ) {
    PipelineConvert.sdk.debug("[PipelineConvert] estimateEqual2Equal", {
      fromWell: fromWell.address,
      toWell: toWell.address,
      amountIn: amountIn.toHuman(),
      slippage
    });

    const BEAN = PipelineConvert.sdk.tokens.BEAN;
    const fromWellBeanIndex = fromWell.tokens.findIndex((t) => t.equals(BEAN));
    const toWellBeanIndex = toWell.tokens.findIndex((t) => t.equals(BEAN));

    const [outIndex0, outIndex1] = await fromWell.getRemoveLiquidityOutEqual(amountIn);

    const sellToken = fromWell.tokens[fromWellBeanIndex === 0 ? 1 : 0];
    const buyToken = toWell.tokens[toWellBeanIndex === 0 ? 1 : 0];

    const sellAmount = fromWellBeanIndex === 0 ? outIndex1 : outIndex0;
    const beanAmount = fromWellBeanIndex === 0 ? outIndex0 : outIndex1;

    const quote = await PipelineConvert.sdk.zeroX.fetchSwapQuote({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount.blockchainString,
      takerAddress: PipelineConvert.sdk.contracts.pipeline.address,
      shouldSellEntireBalance: true,
      skipValidation: true,
      slippagePercentage: slippage.toString()
    });

    const buyAmount = buyToken.fromBlockchain(quote.buyAmount);

    const toWellAmountsIn = [beanAmount, buyAmount];
    if (fromWellBeanIndex === 0) {
      toWellAmountsIn.reverse();
    }

    const amountOut = await toWell.getAddLiquidityOut(toWellAmountsIn);

    const advPipeCalls = this.buildEq2EqAdvancedPipeCalls({
      from: {
        well: fromWell,
        amountIn: amountIn
      },
      swap: {
        buyToken: buyToken,
        sellToken: sellToken,
        quote: quote
      },
      to: {
        well: toWell,
        amountOut
      }
    });

    return {
      fromWellAmountsOut: [beanAmount, sellAmount],
      quote,
      amountOut,
      advPipeCalls
    };
  }

  /**
   * Equal2Equal
   * - remove in equal parts from Well 1
   * - swap non-bean token of well 1 for non-bean token of well 2
   * - add in equal parts to well 2
   * Builds the advanced pipe calls for the pipeline convert
   * @param quote
   */
  public buildEq2EqAdvancedPipeCalls({
    from,
    swap,
    to
  }: {
    from: {
      well: BasinWell;
      amountIn: TokenValue;
    };
    swap: {
      buyToken: ERC20Token;
      sellToken: ERC20Token;
      quote: MinimumViableSwapQuote;
    };
    to: {
      well: BasinWell;
      amountOut: TokenValue;
    };
  }) {
    const sellTokenIndex = from.well.tokens.findIndex(
      (t) => t.address.toLowerCase() === swap.sellToken.address.toLowerCase()
    );

    const pipe: AdvancedPipeCallStruct[] = [];

    // 0: approve from.well.lpToken to use from.well.lpToken
    pipe.push(PipelineConvert.snippets.erc20Approve(from.well.lpToken, from.well.lpToken.address));

    // 1: remove liquidity from from.well
    pipe.push(
      PipelineConvert.snippets.removeLiquidity(
        from.well,
        from.amountIn,
        [TokenValue.ZERO, TokenValue.ZERO],
        from.well.lpToken.address
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

    // 4: transfer BuyToken to to.well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        swap.buyToken,
        to.well.address,
        to.amountOut,
        Clipboard.encodeSlot(3, 0, 1)
      )
    );

    // 5: transfer from.well.tokens[0] to to.well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        from.well.tokens[sellTokenIndex === 1 ? 0 : 1],
        to.well.address,
        TokenValue.MAX_UINT256, // set to max uint256 to ensure transfer succeeds
        Clipboard.encodeSlot(1, 2, 1)
      )
    );

    // 6. Call Sync on to.well
    pipe.push(
      PipelineConvert.snippets.wellSync(
        to.well,
        PipelineConvert.sdk.contracts.pipeline.address, // set recipient to pipeline
        to.amountOut
      )
    );
  }

  private static snippets = {
    erc20Approve: function (
      token: ERC20Token,
      spender: string,
      amount: TokenValue = TokenValue.MAX_UINT256,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("approve", [spender, amount.toBigNumber()]),
        clipboard
      };
    },
    erc20Transfer: function (
      token: ERC20Token,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("transfer", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    removeLiquidity: function (
      well: BasinWell,
      amountIn: TokenValue,
      minAmountsOut: TokenValue[],
      recipient: string,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("removeLiquidity", [
            amountIn.toBigNumber(),
            minAmountsOut.map((a) => a.toBigNumber()),
            recipient,
            ethers.constants.MaxUint256
          ]),
        clipboard: clipboard
      };
    },
    wellSync: function (
      well: BasinWell,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("sync", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    gte: function (
      value: TokenValue,
      compareTo: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
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
    check: function (
      // index of the math or logic operation in the pipe
      index: number
    ): AdvancedPipeCallStruct {
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
