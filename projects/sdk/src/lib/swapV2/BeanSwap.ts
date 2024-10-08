import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Token, ERC20Token, NativeToken } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { BeanSwapQuoter } from "./BeanSwapQuoter";
import { BeanSwapBuilder } from "./BeanSwapBuilder";
import { FarmFromMode, FarmToMode } from "../farm";
import { CallOverrides } from "ethers";
import { SwapNode, ERC20SwapNode } from "./nodes";

export class BeanSwap {
  static sdk: BeanstalkSDK;

  readonly quoter: BeanSwapQuoter;

  constructor(sdk: BeanstalkSDK) {
    BeanSwap.sdk = sdk;
    this.quoter = new BeanSwapQuoter(BeanSwap.sdk);
    BeanSwapOperation.sdk = sdk;
  }

  buildSwap(
    inputToken: ERC20Token | NativeToken,
    targetToken: ERC20Token | NativeToken,
    recipient: string,
    caller: string,
    fromMode?: FarmFromMode,
    toMode?: FarmToMode
  ) {
    return new BeanSwapOperation(
      BeanSwap.sdk,
      this.quoter,
      inputToken,
      targetToken,
      recipient,
      caller,
      fromMode,
      toMode
    );
  }
}

export interface BeanSwapNodeQuote {
  sellToken: ERC20Token | NativeToken;
  buyToken: ERC20Token | NativeToken;
  sellAmount: TokenValue;
  buyAmount: TokenValue;
  minBuyAmount: TokenValue;
  nodes: ReadonlyArray<SwapNode>;
  slippage: number;
}

export class BeanSwapOperation {
  static sdk: BeanstalkSDK;

  readonly quoter: BeanSwapQuoter;

  #builder: BeanSwapBuilder;

  #quoteData: BeanSwapNodeQuote | undefined = undefined;

  readonly inputToken: ERC20Token | NativeToken;

  readonly targetToken: ERC20Token | NativeToken;

  readonly caller: string; // Where the swap is starting. (e.g., Wallet, Pipeline, etc.)

  readonly recipient: string; // Where the swap is going

  fromMode: FarmFromMode;

  toMode: FarmToMode;

  constructor(
    sdk: BeanstalkSDK,
    quoter: BeanSwapQuoter,
    inputToken: ERC20Token | NativeToken,
    targetToken: ERC20Token | NativeToken,
    recipient: string,
    caller: string,
    fromMode?: FarmFromMode,
    toMode?: FarmToMode
  ) {
    BeanSwapOperation.sdk = sdk;
    this.quoter = quoter;
    this.#builder = new BeanSwapBuilder(BeanSwapOperation.sdk);

    this.inputToken = inputToken;
    this.targetToken = targetToken;
    this.recipient = recipient;
    this.caller = caller;
    this.fromMode = fromMode ?? FarmFromMode.EXTERNAL;
    this.toMode = toMode ?? FarmToMode.EXTERNAL;
  }

  updateModes(args: { fromMode?: FarmFromMode; toMode?: FarmToMode }) {
    if (args.fromMode) this.fromMode = args.fromMode;
    if (args.toMode) this.toMode = args.toMode;
    this.#buildQuoteData();
  }

  getPath(): Token[] {
    return this.#builder.nodes
      .map((node, i) => (i === 0 ? [node.sellToken, node.buyToken] : [node.buyToken]))
      .flat();
  }

  getFarm() {
    return this.#builder.workflow;
  }

  get quote() {
    return this.#quoteData;
  }

  /**
   * Refreshes the reserves and prices for all wells and their underlying tokens if the last refresh was more than 15 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   */
  async refresh(force?: boolean) {
    await this.quoter.refresh(force);
  }

  /**
   * Estimates the swap based on the amount and slippage
   * @param amount
   * @param slippage
   * @param force
   * @returns
   */
  async estimateSwap(amount: TokenValue, slippage: number, force?: boolean) {
    if (amount.lte(0)) return;

    if (this.#shouldFetchQuote(amount, slippage) || force === true) {
      this.#quoteData = await this.quoter.route(
        this.inputToken,
        this.targetToken,
        amount,
        slippage
      );
      this.#buildQuoteData();
      await this.estimate();
    }

    return this.#quoteData;
  }

  /**
   * Runs estimate on the advanced farm workflow
   */
  async estimate() {
    if (!this.#quoteData) {
      throw new Error("Cannot estimate without quote data.");
    }
    return this.#builder.workflow.estimate(this.#quoteData.sellAmount.toBigNumber());
  }

  async estimateGas(): Promise<TokenValue> {
    // run estimate if not already done
    if (!this.#builder.workflow.length) {
      await this.estimate();
    }
    if (!this.#builder.workflow.length || !this.#quoteData) {
      throw new Error("Invalid swap configuration. Cannot estimate gas.");
    }
    const gas = await this.#builder.workflow.estimateGas(
      this.#quoteData.sellAmount.toBigNumber(),
      {
        slippage: this.#quoteData.slippage
      }
    );
    return TokenValue.fromBlockchain(gas, 0);
  }

  async execute(overrides: CallOverrides = {}) {
    if (!this.#builder.workflow.length) {
      await this.estimate();
    }
    if (!this.#builder.workflow.length || !this.#quoteData) {
      throw new Error("Invalid swap configuration. Run estimate first.");
    }
    return this.#builder.workflow.execute(
      this.#quoteData.sellAmount,
      { slippage: this.#quoteData.slippage },
      overrides
    );
  }

  #buildQuoteData() {
    if (!this.#quoteData) return;
    this.#builder.translateNodesToWorkflow(
      this.#quoteData.nodes,
      this.fromMode,
      this.toMode,
      this.caller,
      this.recipient
    );
  }

  #shouldFetchQuote(amount: TokenValue, slippage: number) {
    if (this.#quoteData) {
      const { sellAmount, slippage: slip } = this.#quoteData;
      return !sellAmount.eq(amount) || slip !== slippage;
    }
    return true;
  }

  /**
   * Build a swap operation w/ quote data via Beanswap.quoter.
   * @param quoteData
   * @param caller
   * @param recipient
   * @param fromMode
   * @param toMode
   * @returns
   */
  static buildWithQuote(
    quoteData: BeanSwapNodeQuote,
    caller: string,
    recipient: string,
    fromMode: FarmFromMode,
    toMode: FarmToMode
  ) {
    const swap = new BeanSwapOperation(
      BeanSwap.sdk,
      BeanSwap.sdk.beanSwap.quoter,
      quoteData.sellToken,
      quoteData.buyToken,
      caller,
      recipient,
      fromMode,
      toMode
    );
    swap.#quoteData = quoteData;
    swap.#buildQuoteData();
    return swap;
  }
}
