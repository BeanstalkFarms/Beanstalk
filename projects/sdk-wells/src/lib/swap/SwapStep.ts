import { Token, TokenValue } from "@beanstalk/sdk-core";
import { Well as WellContract } from "src/constants/generated";
import { Well } from "../Well";

export enum Direction {
  FORWARD,
  REVERSE
}

export type SwapFromOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["swapFrom"]>;
};
export type SwapToOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["swapTo"]>;
};
export type ShiftOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["shift"]>;
};

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
  slippage: number;

  constructor(well: Well, fromToken: Token, toToken: Token) {
    this.well = well;
    this.fromToken = fromToken;
    this.toToken = toToken;
    this.contract = well.contract;
  }

  async quote(amount: TokenValue, direction: Direction, slippage: number) {
    this.direction = direction;
    this.quoteInput = amount;

    if (this.direction == Direction.FORWARD) {
      this.quoteResult = await this.well.swapFromQuote(this.fromToken, this.toToken, amount);
      this.quoteResultWithSlippage = this.quoteResult.subSlippage(slippage);
    } else {
      this.quoteResult = await this.well.swapToQuote(this.fromToken, this.toToken, amount);
      this.quoteResultWithSlippage = this.quoteResult.addSlippage(slippage);
    }

    this.hasQuoted = true;

    return { quote: this.quoteResult, quoteWithSlippage: this.quoteResultWithSlippage };
  }

  swapSingle(amount: TokenValue, amountWithSlippage: TokenValue, recipient: string, deadline: number): SwapFromOp | SwapToOp {
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

  shift(recipient: string, minAmountOut: TokenValue): ShiftOp | SwapToOp {
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

  swapTo(recipient: string, maxAmountIn: TokenValue, desiredAmount: TokenValue, deadline: number): ShiftOp | SwapToOp {
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
