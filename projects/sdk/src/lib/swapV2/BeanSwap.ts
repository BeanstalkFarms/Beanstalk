import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Token, ERC20Token, NativeToken } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { BeanSwapQuoter } from "./BeanSwapQuoter";
import { BeanSwapBuilder } from "./BeanSwapBuilder";
import { FarmFromMode, FarmToMode } from "../farm";
import { CallOverrides } from "ethers";
import { SwapNode, ERC20SwapNode } from "./nodes";

export class BeanSwap {
  private static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    BeanSwap.sdk = sdk;
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

class BeanSwapOperation {
  private static sdk: BeanstalkSDK;

  #quoter: BeanSwapQuoter;

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
    inputToken: ERC20Token | NativeToken,
    targetToken: ERC20Token | NativeToken,
    recipient: string,
    caller: string,
    fromMode?: FarmFromMode,
    toMode?: FarmToMode
  ) {
    BeanSwapOperation.sdk = sdk;
    this.#quoter = new BeanSwapQuoter(BeanSwapOperation.sdk);
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
    return this.#builder.advancedFarm;
  }

  get quote() {
    return this.#quoteData;
  }

  /**
   * Refreshes the reserves and prices for all wells and their underlying tokens if the last refresh was more than 15 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   */
  async refresh(force?: boolean) {
    await this.#quoter.refresh(force);
  }

  async estimate(amount: TokenValue, slippage: number) {
    if (amount.lte(0)) return;

    if (this.#shouldFetchQuote(amount, slippage)) {
      const routeNodes = await this.#quoter.route(this.inputToken, this.targetToken, amount, slippage);
      this.#quoteData = this.#makeQuote(routeNodes, amount, slippage);
      this.#buildQuoteData();
    }

    return this.#quoteData;
  }

  async estimateGas(amount: TokenValue, slippage: number): Promise<TokenValue> {
    if (!this.#builder.advancedFarm.length || !this.#quoteData) {
      throw new Error("Invalid swap configuration. Run estimate first.");
    }
    const gas = await this.#builder.advancedFarm.estimateGas(amount.toBigNumber(), { slippage: slippage });
    return TokenValue.fromBlockchain(gas, 0);
  }

  async execute(overrides: CallOverrides = {}) {
    if (!this.#builder.advancedFarm.length || !this.#quoteData) {
      throw new Error("Invalid swap configuration. Run estimate first.");
    }
    return this.#builder.advancedFarm.execute(
      this.#quoteData.sellAmount,
      { slippage: this.#quoteData.slippage },
      overrides
    );
  }

  #buildQuoteData() {
    if (!this.#quoteData) return;
    this.#builder.translateNodesToWorkflow(this.#quoteData.nodes, this.fromMode, this.toMode, this.caller, this.recipient);
  }

  #shouldFetchQuote(amount: TokenValue, slippage: number) {
    if (this.#quoteData) {
      const { sellAmount, slippage: slip } = this.#quoteData;
      return !sellAmount.eq(amount) || slip !== slippage;
    }
    return true;
  }

  #makeQuote( nodes: SwapNode[], sellAmount: TokenValue, slippage: number): BeanSwapNodeQuote {
    const last = nodes?.[nodes.length - 1];
    const data: BeanSwapNodeQuote = {
      sellToken: this.inputToken,
      buyToken: this.targetToken,
      sellAmount,
      buyAmount: last?.buyAmount ?? this.inputToken.fromHuman(0),
      minBuyAmount: last?.buyAmount ?? this.targetToken.fromHuman(0),
      slippage,
      nodes: nodes as ReadonlyArray<SwapNode>
    };

    if (last && last instanceof ERC20SwapNode) {
      data.minBuyAmount = last.minBuyAmount;
    }

    return data;
  }
}
