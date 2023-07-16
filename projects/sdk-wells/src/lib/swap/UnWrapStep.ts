import { Token, TokenValue } from "@beanstalk/sdk-core";
import { WETH9, Well as WellContract } from "src/constants/generated";
import { Well } from "../Well";
import { SwapStep } from "./SwapStep";
import { WellsSDK } from "src/index";
import { Operation } from "./Types";

export enum Direction {
  FORWARD,
  REVERSE
}

export class UnWrapEthStep implements SwapStep {
  well: Well;
  contract: WellContract;
  sdk: WellsSDK;
  weth9: WETH9;
  fromToken: Token;
  toToken: Token;

  hasQuoted: boolean = false;
  direction: Direction;
  // Amount used to get a quote
  quoteInput: TokenValue | undefined;

  // The resulting quote
  quoteResult: TokenValue | undefined;
  // The resulting quote after slippage applied
  quoteResultWithSlippage: TokenValue | undefined;
  // The resulting quote's gas estimate
  // quoteGasEstimate: TokenValue | undefined;
  slippage: number;

  constructor(sdk: WellsSDK, weth9: WETH9, fromToken: Token, toToken: Token) {
    this.sdk = sdk;
    this.fromToken = fromToken;
    this.toToken = toToken;
    this.weth9 = weth9;
  }

  async quote(amount: TokenValue, direction: Direction, slippage: number) {
    this.direction = direction;
    this.quoteInput = amount;
    this.hasQuoted = true;
    this.quoteResult = amount;
    this.quoteResultWithSlippage = amount;

    return { quote: amount, quoteWithSlippage: amount };
  }

  swapSingle(amount: TokenValue, amountWithSlippage: TokenValue, recipient: string, deadline: number): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");

    return {
      contract: this.weth9,
      method: "withdraw",
      parameters: [amount.toBlockchain()]
    };
  }

  /**
   * The operation to perform when the swap consists of more than one step in the route. For Wells, this means
   * doing a shift operation through farm/pipeline
   */
  swapMany(recipient: string, minAmountOut: TokenValue): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");
    if (this.direction !== Direction.FORWARD) throw new Error("swapMany() can only be called for quotes where direction was Forward");

    // This is just a placeholder. We don't use this since we have to branch the code and build a different workflow instead
    return {
      contract: this.weth9,
      method: "dummy",
      parameters: []
    };
  }

  /**
   * The operation to perform when the swap consists of more than one step in the route and the direction is reversed.
   */
  swapManyReverse(recipient: string, maxAmountIn: TokenValue, desiredAmount: TokenValue, deadline: number): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");
    if (this.direction !== Direction.REVERSE) throw new Error("swapMany() can only be called for quotes where direction was Reverse");

    // This is just a placeholder. We don't use this since we have to branch the code and build a different workflow instead
    return {
      contract: this.weth9,
      method: "dummy",
      parameters: []
    };
  }
}
