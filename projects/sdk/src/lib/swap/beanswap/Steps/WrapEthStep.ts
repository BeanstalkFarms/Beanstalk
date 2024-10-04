import { NativeToken, TokenValue } from "@beanstalk/sdk-core";
import { Token } from "src/classes/Token";
import { RunContext, StepFunction } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { SwapApproximation } from "src/lib/swap/beanSwap/types";
import { getValidateSwapFields } from "src/lib/swap/beanSwap/utils";
import { Clipboard } from "src/lib/depot";
import { BeanSwapStep } from "./SwapStep";
import { FarmToMode } from "src/lib/farm";

export class WrapEthSwapStep extends BeanSwapStep {
  name = "SwapStep: WrapEth";

  get allowanceTarget() {
    return this.sdk.contracts.beanstalk.address;
  }

  async quoteForward(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number) {
    this.validateUnwrapTokens(sellToken, buyToken);
    this.validate.quoteForwardParams(sellToken, buyToken, sellAmount, slippage);

    const buyAmount = sellAmount;
    const minBuyAmount = sellAmount;

    const approximation: SwapApproximation = {
      maxAmountOut: buyAmount,
      minAmountOut: minBuyAmount
    };

    this.setFields({ sellToken, buyToken, sellAmount, buyAmount, minBuyAmount, slippage });

    return approximation;
  }

  buildStep({ toMode, copySlot }: { toMode: FarmToMode; copySlot: number | undefined }): StepFunction<AdvancedPipePreparedResult> {
    this.validate.all(this.getFields());
    this.validateUnwrapTokens();

    return (_amountInStep, runContext) => {
      const pasteParams = this.getClipboardPasteParams(runContext, copySlot);

      return {
        name: this.name,
        amountOut: _amountInStep,
        value: _amountInStep,
        prepare: () => ({
          target: this.sdk.contracts.beanstalk.address,
          callData: this.sdk.contracts.beanstalk.interface.encodeFunctionData("wrapEth", [
            _amountInStep, // ignore minAmountOut since there is no slippage
            toMode
          ]),
          clipboard: Clipboard.encode(pasteParams ?? [], _amountInStep)
        }),
        decode: (data: string) => this.sdk.contracts.beanstalk.interface.decodeFunctionResult("wrapEth", data),
        decodeResult: (data: string) => this.sdk.contracts.beanstalk.interface.decodeFunctionResult("wrapEth", data)
      };
    };
  }

  validateUnwrapTokens(wrapped?: Token, unwrapped?: Token) {
    const sellTk = wrapped ?? this.sellToken;
    const buyTk = unwrapped ?? this.buyToken;

    this.validate.sellToken(sellTk);
    this.validate.buyToken(buyTk);

    if (!(sellTk instanceof NativeToken)) {
      throw new Error("Invalid sell Token. Sell Token must be ETH.");
    }

    if (!this.sdk.tokens.WETH.equals(buyTk)) {
      throw new Error("Invalid buy token. Buy Token must be WETH.");
    }
  }

  private getClipboardPasteParams(runContext: RunContext, copySlot: number | undefined) {
    try {
      if (copySlot !== undefined && copySlot !== null) {
        const copyIndex = runContext.step.findTag(this.returnIndexTag);
        if (copyIndex !== undefined && copyIndex !== null) {
          return [copyIndex, copySlot, 0] as const
        }
      }
    } catch (e) {
      this.sdk.debug(`[BeanSwapV2Node/getClipboardFromContext]: no clipboard found for ${this.returnIndexTag}`);
      // do nothing else. We only want to check the existence of the tag
    }
    return;
  }
}
