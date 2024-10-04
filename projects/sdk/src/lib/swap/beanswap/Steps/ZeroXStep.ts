import { BigNumber } from "ethers";
import { TokenValue } from "@beanstalk/sdk-core";
import { Token } from "src/classes/Token";
import { StepFunction } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { ZeroExQuoteResponse } from "src/lib/matcha";
import { SwapApproximation } from "src/lib/swap/beanSwap/types";

import { BeanSwapStep, IAmountOutCopySlot } from "./SwapStep";

export class ZeroXSwapStep extends BeanSwapStep implements IAmountOutCopySlot {
  name: string = "SwapStep: ZeroX";

  private _quote: ZeroExQuoteResponse;

  readonly amountOutCopySlot: number = 0;

  get quote() {
    return this._quote;
  }

  get allowanceTarget() {
    return this.quote.allowanceTarget;
  }

  async quoteForward(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number) {
    this.validate.tokens(sellToken, buyToken);
    this.validate.sellAmount(sellAmount);
    this.validate.slippage(slippage);

    const [quote] = await this.sdk.zeroX.quote({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount.toBlockchain(),
      takerAddress: this.sdk.contracts.pipeline.address,
      shouldSellEntireBalance: true,
      skipValidation: true,
      slippagePercentage: (slippage / 100).toString()
    });

    const buyAmount = buyToken.fromBlockchain(quote.buyAmount);
    const minBuyAmount = buyAmount;

    this.setFields({ sellToken, buyToken, sellAmount, buyAmount, minBuyAmount, slippage });

    this._quote = quote;

    return {
      maxAmountOut: buyAmount,
      minAmountOut: minBuyAmount
    } as SwapApproximation;
  }

  buildStep(): StepFunction<AdvancedPipePreparedResult> {
    this.validate.all(this.getFields());
    this.validateQuote();

    return (_amountInStep, _) => {
      return {
        name: `${this.name}-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: this.quote.allowanceTarget,
          callData: this.quote.data as string,
          clipboard: undefined
        }),
        decode: () => undefined,
        decodeResult: () => undefined
      };
    };
  }

  validateQuote() {
    if (!this.quote) {
      throw new Error("Error building swap step. No 0x quote found.");
    }
  }
}
