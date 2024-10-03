import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { BeanSwapV2 } from "./BeanSwapV2";
import { ERC20Token } from "src/classes/Token";

import { FarmFromMode, FarmToMode } from "../farm";
import { BeanSwapV2Quote, BeanSwapV2QuoterResult, BeanSwapV2SimpleQuote } from "./types";
import {
  SwapV2Node,
  SwapV2WellNode,
  UnwrapEthNode,
  WrapEthNode,
  ZeroXSwapNode
} from "./SwapV2Node";
import { StepFunction } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "../depot/pipe";
import { BigNumber, ethers } from "ethers";

export class BeanSwapV2Builder {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    BeanSwapV2Builder.sdk = sdk;
    this.swapV2 = swapV2;
  }

  build(quotes: BeanSwapV2Quote[], caller: string, recipient: string, _fromMode: FarmFromMode, _toMode: FarmToMode): BeanSwapV2QuoterResult {
    if (!quotes.length) {
      throw new Error("Unable to build quotes. No paths found.");
    }

    const first = quotes[0];
    const last = quotes[quotes.length - 1];

    const inputToken = first.sellToken;
    const outputToken = last.buyToken;

    const pipeline = BeanSwapV2Builder.sdk.contracts.pipeline;

    const simpleQuotes: BeanSwapV2SimpleQuote[] = [];
    const advancedFarm = BeanSwapV2Builder.sdk.farm.createAdvancedFarm(
      `BeanSwapV2 advFarm - ${first.sellToken.symbol} -> ${last.buyToken.symbol}`
    );
    const advPipeCalls = BeanSwapV2Builder.sdk.farm.createAdvancedPipe(
      `BeanSwapV2 advPipe - ${first.sellToken.symbol} -> ${last.buyToken.symbol}`
    );

    // If the first quote is not a wrap or unwrap, we opt to always transfer to pipeline for simplicity.
    const callerIsPipeline = caller.toLowerCase() === pipeline.address.toLowerCase();
    const recipientIsPipeline = recipient.toLowerCase() === pipeline.address.toLowerCase();

    if (
      // If the first & only quote is a wrap or unwrap, we don't need to transfer to pipeline. Adv farm can handle it.
      quotes.length === 1 &&
      (first.sourceType === "WRAP_ETH" || first.sourceType === "UNWRAP_ETH")
    ) {
      advancedFarm.add(
        first.node.buildFromQuote({ quote: first, fromMode: _fromMode, toMode: _toMode })
      );
    } else {
      let from: FarmFromMode;
      let to: FarmToMode;

      for (const [i, quote] of quotes.entries()) {
        const isLast = i === quotes.length - 1;
        // Should never happen. ETH should never be a mid-swap token.
        if (this.isUnwrapEth(quote)) {
          throw new Error("Error building quote. Unwrap ETH is not currently supported mid-swap");
        }

        const node = quote.node;
        simpleQuotes.push(this.slimplifyQuote(quote));

        // first leg
        if (i === 0) {
          from = _fromMode;
          to = FarmToMode.INTERNAL;

          // If sellToken is ETH, wrap first
          if (this.isWrapEth(quote)) {
            if (callerIsPipeline) {
              throw new Error("Error building quote. Wrap ETH is not currently supported mid-swap");
            }
            this.validateWrapETH(quote);

            // We transfer to internal_tolerant b/c there will always be more steps after this
            advancedFarm.add(quote.node.buildFromQuote({ quote, toMode: to }), { tag: quote.tag });
            from = FarmFromMode.INTERNAL_TOLERANT;
          }

          // Transfer token to pipeline if caller is not pipeline
          if (!callerIsPipeline) {
            advancedFarm.add(this.transferToPipeline(quote.sellToken as ERC20Token, from));
          }
        }
        // Last leg
        else if (i === quotes.length - 1) {
          from = FarmFromMode.INTERNAL_TOLERANT;
          to = _toMode;
        }
        // Between legs
        else {
          from = FarmFromMode.INTERNAL_TOLERANT;
          to = FarmToMode.EXTERNAL;
        }

        const copySlot = i !== 0 ? quotes[i - 1].node.amountOutCopySlot : undefined;

        if (this.isWellSwap(node) || this.isZeroXSwap(node)) {
          advPipeCalls.add(this.approveERC20(quote));
          advPipeCalls.add(quote.node.buildFromQuote({ quote, copySlot }), { tag: quote.tag });
        }

        if (isLast) {
          if (!recipientIsPipeline) {
            let _buyToken = last.buyToken;
            let _lastTag = last.tag;
            let _copySlot = copySlot;

            // if unwrapping ETH, transfer should happen before the unwrap
            if (this.isUnwrapEth(node)) {
              this.validateUnwrapEth(quote);
              const buyWETHStep = quotes[i - 1];
              _buyToken = buyWETHStep.buyToken as ERC20Token;
              _lastTag = buyWETHStep.tag;
              _copySlot = buyWETHStep.node.amountOutCopySlot;

              if (!BeanSwapV2Builder.sdk.tokens.WETH.equals(_buyToken)) {
                throw new Error(`Misordered quotes. Expected BuyToken WETH, but got ${buyWETHStep.buyToken.symbol}`);
              }
            }

            if (_copySlot === undefined) {
              throw new Error(`Error building quote. No copy slot found. Unable to transfer tokens ${last.buyToken.symbol} to recipient.`);
            }

            advPipeCalls.add(
              this.transferToRecipient(_buyToken as ERC20Token, recipient, to, from, _lastTag, _copySlot)
            );
          }

          if (this.isUnwrapEth(node)) {
            advancedFarm.add(
              quote.node.buildFromQuote({ quote, fromMode: FarmFromMode.INTERNAL_TOLERANT })
            );
          }
        }
      }
    }

    if (!!advPipeCalls.length) {
      advancedFarm.add(advPipeCalls);
    }

    return {
      sellToken: inputToken,
      sellAmount: first.sellAmount,
      maxSellAmount: first.maxSellAmount,
      buyToken: outputToken,
      buyAmount: last.buyAmount,
      minBuyAmount: last.minBuyAmount,
      usd: last.usd,
      routes: simpleQuotes,
      advancedFarm
    };
  }

  private slimplifyQuote(quote: BeanSwapV2Quote): BeanSwapV2SimpleQuote {
    return {
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      maxSellAmount: quote.maxSellAmount,
      minBuyAmount: quote.minBuyAmount,
      usd: quote.usd,
      sourceName: quote.sourceName
    };
  }

  private transferToPipeline(inputToken: ERC20Token, fromMode: FarmFromMode) {
    return new BeanSwapV2Builder.sdk.farm.actions.TransferToken(
      inputToken.address,
      BeanSwapV2Builder.sdk.contracts.pipeline.address, // always transfer to pipeline
      fromMode,
      FarmToMode.EXTERNAL // always transfer to internal
    );
  }

  private transferToRecipient(
    outputToken: ERC20Token,
    recipient: string,
    toMode: FarmToMode,
    fromMode: FarmFromMode,
    tag: string,
    copyIndex: number
  ) {
    const lastActionClipboard = {
      tag,
      copySlot: copyIndex
    };

    const approveBeanstalkClipboard = {
      ...lastActionClipboard,
      pasteSlot: 1
    };

    const transferToRecipientClipboard = {
      ...lastActionClipboard,
      pasteSlot: 2
    };

    const approveBack = new BeanSwapV2Builder.sdk.farm.actions.ApproveERC20(
      outputToken as ERC20Token,
      BeanSwapV2Builder.sdk.contracts.beanstalk.address,
      approveBeanstalkClipboard
    );

    const transferToRecipient = new BeanSwapV2Builder.sdk.farm.actions.TransferToken(
      outputToken.address,
      recipient,
      fromMode,
      toMode,
      transferToRecipientClipboard
    );

    return [approveBack, transferToRecipient];
  }

  private approveERC20(quote: BeanSwapV2Quote) {
  
    // Build a custom one here as opposed to using sdk.farm.actions.ApproveERC20
    // b/c we want to approve max to the allowance target.
    const approvalStepFunction: StepFunction<AdvancedPipePreparedResult> = (_amountInStep) => {
      const { sellToken } = quote;

      if (!(sellToken instanceof ERC20Token)) {
        BeanSwapV2Builder.sdk.debug("Invalid sell token. Cannot approve Native token. Got: ", sellToken);
        throw new Error("Invalid sell token. Cannot approve Native token.");
      }

      return {
        name: "approve",
        amountOut: quote.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: sellToken.address,
          callData: sellToken.getContract().interface.encodeFunctionData("approve", [
            quote.allowanceTarget,
            TokenValue.MAX_UINT256.toBigNumber() // approve allowance target to use pipeline's balance MAX
          ]),
          clipboard: ethers.constants.HashZero
        }),
        decode: (data: string) =>
          sellToken.getContract().interface.decodeFunctionData("approve", data),
        decodeResult: (data: string) =>
          sellToken.getContract().interface.decodeFunctionResult("approve", data)
      };
    };

    return approvalStepFunction;
  }

  private isWellSwap(arg: SwapV2Node | BeanSwapV2Quote) {
    if (arg instanceof SwapV2Node) {
      return arg instanceof SwapV2WellNode;
    }
    return arg.sourceType === "WELL" && arg.node instanceof SwapV2WellNode;
  }

  private isZeroXSwap(arg: SwapV2Node | BeanSwapV2Quote) {
    if (arg instanceof SwapV2Node) {
      return arg instanceof ZeroXSwapNode;
    }
    return arg.sourceType === "0x" && arg.node instanceof ZeroXSwapNode;
  }

  private isUnwrapEth(arg: SwapV2Node | BeanSwapV2Quote) {
    if (arg instanceof SwapV2Node) {
      return arg instanceof UnwrapEthNode;
    }

    return arg.sourceType === "UNWRAP_ETH" && arg.node instanceof UnwrapEthNode;
  }

  private isWrapEth(arg: SwapV2Node | BeanSwapV2Quote) {
    if (arg instanceof SwapV2Node) {
      return arg instanceof WrapEthNode;
    }
    return arg.sourceType === "WRAP_ETH" && arg.node instanceof WrapEthNode;
  }

  private validateWrapETH(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "WRAP_ETH") return;

    if (!BeanSwapV2Builder.sdk.tokens.WETH.equals(quote.buyToken)) {
      throw new Error(
        `Misconfigured quote. Expected BuyToken WETH, but got ${quote.buyToken.symbol}`
      );
    }
    if (!quote.sellToken.equals(BeanSwapV2Builder.sdk.tokens.ETH)) {
      throw new Error(
        `Misconfigured quote. Expected SellToken ETH, but got ${quote.sellToken.symbol}`
      );
    }
  }

  private validateUnwrapEth(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "UNWRAP_ETH") return;

    if (!BeanSwapV2Builder.sdk.tokens.WETH.equals(quote.sellToken)) {
      throw new Error(
        `Misconfigured quote. Expected SellToken WETH, but got ${quote.sellToken.symbol}`
      );
    }

    if (!quote.buyToken.equals(BeanSwapV2Builder.sdk.tokens.ETH)) {
      throw new Error(
        `Misconfigured quote. Expected BuyToken ETH, but got ${quote.buyToken.symbol}`
      );
    }
  }
}
