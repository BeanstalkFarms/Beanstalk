import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { Token, ERC20Token, NativeToken } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { BeanSwapQuoter } from "./BeanSwapQuoter";
import { BeanSwapBuilder } from "./BeanSwapBuilder";
import { FarmFromMode, FarmToMode } from "../farm";

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

class BeanSwapOperation {
  private static sdk: BeanstalkSDK;

  #quoter: BeanSwapQuoter;

  #builder: BeanSwapBuilder;

  // Where the swap is starting. (e.g., Wallet, Pipeline, etc.)
  caller: string;

  // Where the swap is going
  recipient: string;

  inputToken: ERC20Token | NativeToken;

  targetToken: ERC20Token | NativeToken;

  fromMode: FarmFromMode;

  toMode: FarmToMode;

  #amount: TokenValue | undefined;

  #slippage: number | undefined;

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
    this.caller = caller ?? this.recipient;
    this.fromMode = fromMode ?? FarmFromMode.EXTERNAL;
    this.toMode = toMode ?? FarmToMode.EXTERNAL;
  }

  setRecipient(recipient: string) {
    this.recipient = recipient;
  }

  setCaller(caller: string) {
    this.caller = caller;
  }

  setInputToken(token: ERC20Token | NativeToken) {
    this.inputToken = token;
  }

  setTargetToken(token: ERC20Token | NativeToken) {
    this.targetToken = token;
  }

  setFarmToMode(mode: FarmToMode) {
    this.toMode = mode;
  }

  setFarmFromMode(mode: FarmFromMode) {
    this.fromMode = mode;
  }

  getPath(): Token[] {
    return this.#builder.nodes
      .map((node, i) => (i === 0 ? [node.sellToken, node.buyToken] : [node.buyToken]))
      .flat();
  }

  getFarm() {
    return this.#builder.advancedFarm;
  }

  /**
   * Refreshes the reserves and prices for all wells and their underlying tokens if the last refresh was more than 15 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   */
  async refresh(force?: boolean) {
    await this.#quoter.refresh(force);
  }

  //prettier-ignore
  async estimate(amount: TokenValue, slippage: number) {
    await this.refresh(false);

    const nodes = await this.#quoter.getQuote(this.inputToken, this.targetToken, amount, slippage);
    if (!nodes.length) {
      throw new Error("Unable to estimate swap quote. No paths found.");
    }
    this.#builder.translateNodesToWorkflow(nodes, this.fromMode, this.toMode, this.caller, this.recipient);
    await this.#builder.advancedFarm.estimate(amount);
    this.#amount = amount;
    this.#slippage = slippage;
  }

  async execute() {
    if (!this.#amount || !this.#slippage) {
      throw new Error("Cannot execute swap without an estimate.");
    }
    return this.#builder.advancedFarm.execute(this.#amount, { slippage: this.#slippage });
  }
}
