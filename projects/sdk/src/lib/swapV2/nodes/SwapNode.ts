import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepFunction, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { Token, ERC20Token, NativeToken } from "src/classes/Token";

export interface ISwapNode {
  sellToken: Token;
  buyToken: Token;
  sellAmount: TokenValue;
  buyAmount: TokenValue;
}

export interface IERC20SwapNode {
  minBuyAmount: TokenValue;
  slippage: number;
  amountOutCopySlot: number;
}

type ISwapNodeUnion = ISwapNode & IERC20SwapNode;

type BuildStepParams = Partial<{
  copySlot: number;
  fromMode: FarmFromMode;
  toMode: FarmToMode;
}>;

// prettier-ignore
export abstract class SwapNode implements ISwapNode {
  protected static sdk: BeanstalkSDK;
  /** 
   * The Token to exchange 
   */
  name: string;
  /** 
   * The token to recieve 
   */
  sellToken: Token;
  /** 
   * amount of sellToken to exchange 
   */
  sellAmount: TokenValue;
  /** 
   * amount of buyToken to receive 
   */
  buyToken: Token;
  /** 
   * minimum amount of buyToken to receive after swap 
   */
  buyAmount: TokenValue;
  /**
   * The address that should be approved to perform the txn in buildStep
   */
  abstract readonly allowanceTarget: string;

  /// ----------------------------------------

  constructor(sdk: BeanstalkSDK) {
    SwapNode.sdk = sdk;
  }

  /**
   * Build the swap step
   * @param args copySlot, fromMode, toMode
   */
  abstract buildStep(args: BuildStepParams): StepFunction<AdvancedPipePreparedResult> | StepClass<AdvancedPipePreparedResult>;

  /**
   * The tag for the amount out for THIS node. Subsequent nodes will copy from this value.
   */
  get tag(): `get-${string}` {
    return `get-${this.buyToken.symbol}`;
  }

  /**
   * The clipboard tag of a PREVIOUS node that this step will copy from
   */
  get returnIndexTag(): `get-${string}` {
    return `get-${this.sellToken.symbol}`;
  }

  /**
   * Set the fields of the node
   */
  setFields(args: Partial<ISwapNodeUnion>) {
    Object.entries(args).forEach(([key, value]) => {
      if (key in this && value !== undefined && value !== null) {
        // @ts-ignore
        this[key] = value;
      }
    });

    return this;
  }

  /// ----------------------------------------  
  /// ------------ VALIDATION ------------ ///
  protected makeErrorWithContext(msg: string) {
    return new Error(`Error: building swap step in ${this.name}: ${msg}`);
  }
  protected validateIsERC20Token(token: Token) {
    if (!(token instanceof ERC20Token)) {
      throw this.makeErrorWithContext(`Expected ERC20 token but got ${token.symbol}.`);
    }
  }
  protected validateIsNativeToken(token: Token) {
    if (!(token instanceof NativeToken)) {
      throw this.makeErrorWithContext(`Expected Native token but got ${token.symbol}.`);
    }
  }
  protected validateTokens() {
    if (!this.sellToken) {
      throw this.makeErrorWithContext("Sell token is required.");
    }
    if (!this.buyToken) {
      throw this.makeErrorWithContext("buy token is required.");
    }
    if (this.sellToken.equals(this.buyToken)) {
      throw this.makeErrorWithContext(`Expected unique tokens. ${this.sellToken.symbol} and ${this.buyToken.symbol}`);
    }
  }
  protected validateSellAmount() {
    if (!this.sellAmount) {  
      throw this.makeErrorWithContext("sell amount is required.");
    }
    if (this.sellAmount.lte(0)) {
      throw this.makeErrorWithContext("sell amount must be greater than 0.");
    }
  }
  protected validateBuyAmount() {
    if (!this.buyAmount) {
      throw this.makeErrorWithContext("buy amount is required.");
    }
    if (this.buyAmount.lte(0)) {
      throw this.makeErrorWithContext("buy amount must be greater than 0.");
    }
    return true;
  }
}
