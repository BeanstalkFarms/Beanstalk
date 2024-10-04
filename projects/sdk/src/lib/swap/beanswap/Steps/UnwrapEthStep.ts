import { TokenValue, NativeToken } from "@beanstalk/sdk-core";
import { Token } from "src/classes/Token";
import { StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { BeanSwapStep } from "./SwapStep";
import { FarmFromMode } from "src/lib/farm";

interface BuildParams {
  fromMode: FarmFromMode;
}

export class UnwrapEthSwapStep extends BeanSwapStep {
  name = "SwapStep: UnwrapEth";

  get allowanceTarget() {
    return this.sdk.contracts.beanstalk.address;
  }

  async quoteForward(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number) {
    this.validateUnwrapTokens(sellToken, buyToken);
    this.validate.quoteForwardParams(sellToken, buyToken, sellAmount, slippage);

    const buyAmount = sellAmount;
    const minBuyAmount = sellAmount;

    
    this.setFields({ sellToken, buyToken, sellAmount, buyAmount, minBuyAmount, slippage });

    return {
      maxAmountOut: buyAmount,
      minAmountOut: minBuyAmount
    };
  }

  buildStep({ fromMode }: BuildParams): StepClass<AdvancedPipePreparedResult> {
    this.validate.all(this.getFields());
    this.validateUnwrapTokens();

    return new this.sdk.farm.actions.UnwrapEth(fromMode);
  }

  validateUnwrapTokens(wrapped?: Token, unwrapped?: Token) {
    const sellTk = wrapped ?? this.sellToken;
    const buyTk = unwrapped ?? this.buyToken;

    this.validate.sellToken(sellTk);
    this.validate.buyToken(buyTk);

    if (!this.sdk.tokens.WETH.equals(sellTk)) {
      throw new Error("Invalid sell token. Sell Token must be WETH.");
    }

    if (!(buyTk instanceof NativeToken)) {
      throw new Error("Invalid buy token. Buy Token must be ETH.");
    }
  }
}