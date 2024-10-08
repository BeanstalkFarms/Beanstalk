import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepFunction, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { Token } from "src/classes/Token";
import { isERC20Token } from "src/utils/token";

export interface ISwapNodeSettable {
  sellAmount: TokenValue;
  buyAmount: TokenValue;
}
export interface ISwapNode extends ISwapNodeSettable {
  sellToken: Token;
  buyToken: Token; 
}

type BuildStepParams = Partial<{
  copySlot: number;
  fromMode: FarmFromMode;
  toMode: FarmToMode;
  recipient: string;
}>;

type ValidBuildStepReturn = StepFunction<AdvancedPipePreparedResult> | StepClass<AdvancedPipePreparedResult>;

export abstract class SwapNode implements ISwapNode {
  protected static sdk: BeanstalkSDK;

  name: string;

  /** Token to exchange */
  readonly sellToken: Token;
  
  /** Token to receive */
  readonly buyToken: Token;

  /** Amount of SellToken to exchange */
  sellAmount: TokenValue;
  
  /** Max amount of of buyToken received */
  buyAmount: TokenValue;

  /** The address that should be approved to perform the txn in buildStep */
  abstract readonly allowanceTarget: string;

  /// ----------------------------------------

  constructor(sdk: BeanstalkSDK) {
    SwapNode.sdk = sdk;
  }

  /**
   * Build the swap step
   * @param args copySlot, fromMode, toMode
   */
  abstract buildStep(args?: BuildStepParams): ValidBuildStepReturn | ValidBuildStepReturn[];


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
  setFields<T extends ISwapNodeSettable>(args: Partial<T>) {
    Object.assign(this, args);
    return this;
  }

  /// ----------------------------------------  
  /// ------------ VALIDATION ------------ ///
  protected makeErrorWithContext(msg: string) {
    return new Error(`Error: building swap step in ${this.name}: ${msg}`);
  }
  protected validateIsERC20Token(token: Token) {
    if (!(isERC20Token(token))) {
      throw this.makeErrorWithContext(`Expected ERC20 token but got ${token.symbol}.`);
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
