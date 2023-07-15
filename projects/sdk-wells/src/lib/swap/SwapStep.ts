import { Token, TokenValue } from "@beanstalk/sdk-core";
import { Well as WellContract } from "src/constants/generated";
import { Well } from "../Well";
import { Operation } from "./Types";

export enum Direction {
  FORWARD,
  REVERSE
}

export class SwapStep {
  well: Well;
  fromToken: Token;
  toToken: Token;
  contract: WellContract;
  hasQuoted: boolean = false;
  direction: Direction;
  // Amount used to get a quote
  quoteInput: TokenValue | undefined;

  // The resulting quote
  quoteResult: TokenValue | undefined;
  // The resulting quote after slippage applied
  quoteResultWithSlippage: TokenValue | undefined;
  // The resulting quote's gas estimate
  quoteGasEstimate: TokenValue | undefined;
  slippage: number;

  constructor(well: Well, fromToken: Token, toToken: Token) {
    this.well = well;
    this.fromToken = fromToken;
    this.toToken = toToken;
    this.contract = well.contract;
  }

  async quote(amount: TokenValue, direction: Direction, slippage: number, recipient: string) {
    this.direction = direction;
    this.quoteInput = amount;

    if (this.direction == Direction.FORWARD) {
      this.quoteResult = await this.well.swapFromQuote(this.fromToken, this.toToken, amount);
      this.quoteResultWithSlippage = this.quoteResult.subSlippage(slippage);
      try {
        this.quoteGasEstimate = await this.well.swapFromGasEstimate(
          this.fromToken,
          this.toToken,
          amount,
          this.quoteResultWithSlippage,
          recipient
        );
      } catch {
        this.quoteGasEstimate = TokenValue.ZERO;
      }
    } else {
      this.quoteResult = await this.well.swapToQuote(this.fromToken, this.toToken, amount);
      this.quoteResultWithSlippage = this.quoteResult.addSlippage(slippage);
      try {
        this.quoteGasEstimate = await this.well.swapToGasEstimate(
          this.fromToken,
          this.toToken,
          this.quoteResultWithSlippage,
          amount,
          recipient
        );
      } catch {
        this.quoteGasEstimate = TokenValue.ZERO;
      }
    }

    this.hasQuoted = true;

    return { quote: this.quoteResult, quoteWithSlippage: this.quoteResultWithSlippage, quoteGasEstimate: this.quoteGasEstimate };
  }

  /**
   * The operation to perform when the swap consists of a single step in the route. IE, the to and from tokens are in the same well
   */
  swapSingle(amount: TokenValue, amountWithSlippage: TokenValue, recipient: string, deadline: number): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");

    return this.direction === Direction.FORWARD
      ? {
          contract: this.well.contract,
          method: "swapFrom",
          parameters: [
            this.fromToken.address,
            this.toToken.address,
            amount.toBigNumber(),
            amountWithSlippage.toBigNumber(),
            recipient,
            deadline
          ]
        }
      : {
          contract: this.well.contract,
          method: "swapTo",
          parameters: [
            this.fromToken.address,
            this.toToken.address,
            amountWithSlippage.toBigNumber(),
            amount.toBigNumber(),
            recipient,
            deadline
          ]
        };
  }

  /**
   * The operation to perform when the swap consists of more than one step in the route. For Wells, this means
   * doing a shift operation through farm/pipeline
   */
  swapMany(recipient: string, minAmountOut: TokenValue): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");
    if (this.direction !== Direction.FORWARD) throw new Error("swapMany() can only be called for quotes where direction was Forward");

    const amount = this.quoteResult;
    // This should never happen, but sanity check
    if (!amount) throw new Error(`Step is missing forward lastQuote`);

    return {
      contract: this.well.contract,
      method: "shift",
      parameters: [this.toToken.address, minAmountOut.toBlockchain(), recipient]
    };
  }

  /**
   * The operation to perform when the swap consists of more than one step in the route and the direction is reversed.
   */
  swapManyReverse(recipient: string, maxAmountIn: TokenValue, desiredAmount: TokenValue, deadline: number): Operation {
    if (!this.hasQuoted) throw new Error("Must do a quote before swapping");
    if (this.direction !== Direction.REVERSE) throw new Error("swapMany() can only be called for quotes where direction was Reverse");

    return {
      contract: this.well.contract,
      method: "swapTo",
      parameters: [
        this.fromToken.address,
        this.toToken.address,
        maxAmountIn.toBlockchain(),
        desiredAmount.toBlockchain(),
        recipient,
        deadline
      ]
    };
  }
}
