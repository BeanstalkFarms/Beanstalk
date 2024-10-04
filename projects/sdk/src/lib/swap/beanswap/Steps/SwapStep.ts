import { ERC20Token, NativeToken, TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { SwapApproximation } from "../types";
import { StepFunction, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { Token } from "src/classes/Token";
import { getValidateSwapFields, isValidSwapStepParam } from "../utils";

type IBuildStepArgs = Partial<{
  copySlot: number | undefined;
  fromMode: FarmFromMode;
  toMode: FarmToMode;
}>;

export interface IAmountOutCopySlot {
  amountOutCopySlot: number;
}

export interface IBeanSwapStepParams {
  //
  sellToken: Token;
  //
  buyToken: Token;
  //
  sellAmount: TokenValue;
  //
  buyAmount: TokenValue;
  /** minimum amount of buyToken to receive after swap */
  minBuyAmount: TokenValue;
  //
  slippage: number;
}

// prettier-ignore
export abstract class BeanSwapStep implements IBeanSwapStepParams {
  protected sdk: BeanstalkSDK;

  name: string;

  sellToken: Token;

  sellAmount: TokenValue;

  buyToken: Token;

  buyAmount: TokenValue;

  minBuyAmount: TokenValue;

  slippage: number;

  abstract allowanceTarget: string;

  constructor(sdk: BeanstalkSDK) {
    this.sdk = sdk;
  }

  /// ---------- ABSTRACT METHODS ---------- ///

  /**
   * Quote the amount of buyToken that will be received for selling sellToken
   * @param sellToken 
   * @param buyToken 
   * @param sellAmount 
   * @param slippage 
   */
  abstract quoteForward(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number): Promise<SwapApproximation>;


  /**
   * Build the swap step
   * @param args copySlot | fromMode | toMode
   */
  abstract buildStep(args: IBuildStepArgs): StepFunction<AdvancedPipePreparedResult> | StepClass<AdvancedPipePreparedResult>;

    
  // ---------- GETTERS ---------- ///

  /**
   * The tag for the amount out subsequent steps will copy from
   */
  get tag(): `get-${string}` {
    return `get-${this.buyToken.symbol}`;
  }

  /**
   * The clipboard tag of another step that this step will copy from
   */
  get returnIndexTag(): `get-${string}` {
    return `get-${this.sellToken.symbol}`;
  }

  /// ---------- HELPER METHODS ---------- ///

  setFields<K extends keyof IBeanSwapStepParams>(args: Pick<IBeanSwapStepParams, K>) {
    (Object.keys(args) as K[]).forEach((key) => {
      if (key in this) {
        type ValueType = IBeanSwapStepParams[K];
        const value = args[key] as ValueType;

        if (isValidSwapStepParam(key, value)) {
          (this[key] as ValueType) = value;
        }
      }
    });
  }

  protected getFields() {
    return {
      sellToken: this.sellToken,
      sellAmount: this.sellAmount,
      buyToken: this.buyToken,
      buyAmount: this.buyAmount,
      minBuyAmount: this.minBuyAmount,
      slippage: this.slippage
    };
  }

  /// ---------- VALIDATIONS ---------- ///

  makeError(msg: string){
    return new Error(`Error: building swap step in ${this.name}: ${msg}`);
  }

  // Token
  private isERC20(token: Token): token is ERC20Token {
    return token instanceof ERC20Token;
  }
  private isNative(token: Token): token is NativeToken {
    return token instanceof NativeToken;
  }

  private validateTokenType(token: Token): token is NativeOrERC20 {
    if (!this.isNative(token) || !this.isERC20(token)) {
      throw this.makeError(`Expected either an ERC20 or Native token but got ${token.symbol}.`);
    }
    return true;
  }

  private validateSellToken(token: Token | null): token is NonNullable<Token> {
    if (!token) {
      throw this.makeError("Sell token is required.");
    }
    return this.validateTokenType(token);
  }

  private validateBuyToken(token: Token | null) {
    if (!token) {
      throw this.makeError("buy token is required.");
    }
    return this.validateTokenType(token);
  }

  private validateUniqueTokens(sellToken: Token | null, buyToken: Token | null) {
    if (!this.validateSellToken(sellToken) || !this.validateBuyToken(buyToken)) {
      return false;
    }

    if (sellToken.address.toLowerCase() === buyToken.address.toLowerCase()) {
      throw this.makeError("sell token and buy token are the same token. Expected unique tokens.");
    }
    return true;
  }

  // Amounts

  private validateSellAmount(amount: TokenValue | null): amount is NonNullable<TokenValue> {
    if (!amount) {
      throw this.makeError("sell amount is required.");
    }
    if (amount.lte(0)) {
      throw this.makeError("sell amount must be greater than 0.");
    }
    return true;
  }

  private validateBuyAmount(amount: TokenValue | null): amount is NonNullable<TokenValue> {
    if (!amount) {
      throw this.makeError("buy amount is required.");
    }
    if (amount.lte(0)) {
      throw this.makeError("buy amount must be greater than 0.");
    }
    return true;
  }

  private validateMinBuyAmount(minBuyAmount: TokenValue | null, buyAmount: TokenValue | null): minBuyAmount is NonNullable<TokenValue> {
    if (!this.validateBuyAmount(buyAmount)) return false;
    if (!minBuyAmount) {
      throw this.makeError("mininum buy amount has not been set.");
    }

    if (minBuyAmount.gt(buyAmount)) {
      throw this.makeError(`Expected min buy amount to be < buy amount, but got ${minBuyAmount} and buyAmount: ${buyAmount}`);
    }
    return true;
  }

  // Slippage
  private validateSlippage(slippage: number | null): slippage is NonNullable<number> {
    if (slippage === null || slippage === undefined) {
      throw this.makeError("Slippage is required");
    }
    if (slippage < 0 || slippage > 1) {
      throw this.makeError(`Expected slippage to be between 0 and 100% but got ${slippage}`);
    }
    return true;
  }


  // Catch-alls
  private validateQuoteForwardParams(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number) {
    this.validateTokens(sellToken, buyToken);
    this.validateSellAmount(sellAmount);
    this.validateSlippage(slippage);
  }

  private validateAmounts(sellAmount: TokenValue | null, buyAmount: TokenValue | null, minBuyAmount: TokenValue | null) {
    this.validateSellAmount(sellAmount);
    this.validateBuyAmount(buyAmount);
    this.validateMinBuyAmount(minBuyAmount, buyAmount);
  }

  private validateTokens(sellToken: Token | null, buyToken: Token | null) {
    this.validateSellToken(sellToken);
    this.validateBuyToken(buyToken);
    this.validateUniqueTokens(sellToken, buyToken);
  }

  private validateAll(args: {
    sellToken: Token | null, 
    buyToken: Token | null, 
    sellAmount: TokenValue, 
    buyAmount: TokenValue, 
    minBuyAmount: TokenValue, 
    slippage: number
  }) {
    this.validateTokens(args.sellToken, args.buyToken);
    this.validateAmounts(args.sellAmount, args.buyAmount, args.minBuyAmount);
    this.validateSlippage(args.slippage);
  }

  validate = {
    all: this.validateAll,
    sellToken: this.validateSellToken,
    buyToken: this.validateBuyToken,
    sellAmount: this.validateSellAmount,
    buyAmount: this.validateBuyAmount,
    minBuyAmount: this.validateMinBuyAmount,
    slippage: this.validateSlippage,
    quoteForwardParams: this.validateQuoteForwardParams,
    amounts: this.validateAmounts,
    tokens: this.validateTokens,
  }
}

type NativeOrERC20 = NativeToken | ERC20Token;