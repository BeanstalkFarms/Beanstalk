import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ERC20Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { BeanSwapV2Quote } from "./types";
import { BigNumber } from "ethers";
import { BeanSwapV2 } from "./BeanSwapV2";
import { RunContext, StepClass, StepFunction } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "../depot/pipe";
import { FarmFromMode, FarmToMode } from "../farm";

type BuildFromQuoteArgs = {
  quote: BeanSwapV2Quote;
  copySlot?: number;
  fromMode?: FarmFromMode;
  toMode?: FarmToMode;
};

export abstract class SwapV2Node {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  name: string;

  abstract amountOutCopySlot: number | undefined;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    SwapV2Node.sdk = sdk;
    this.swapV2 = swapV2;
  }

  abstract buildFromQuote(
    args: BuildFromQuoteArgs
  ): StepFunction<AdvancedPipePreparedResult> | StepClass<AdvancedPipePreparedResult>;
}

export class ZeroXSwapNode extends SwapV2Node {
  name: string = "0x-swapnode";

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    super(sdk, swapV2);
  }

  readonly amountOutCopySlot = 0;

  async quote(sellToken: ERC20Token, buyToken: ERC20Token, amount: TokenValue, slippage: number) {
    if (sellToken.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw new Error("[BeanSwapV2Quoter/quoteWith0x]: expected sellToken to be a non-BEAN token");
    }
    if (buyToken.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw new Error("[BeanSwapV2Quoter/quoteWith0x]: expected buyToken to be a non-BEAN token");
    }

    const zeroXQuote = await ZeroXSwapNode.sdk.zeroX
      .quote({
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: amount.toBlockchain(),
        takerAddress: ZeroXSwapNode.sdk.contracts.pipeline.address,
        shouldSellEntireBalance: true,
        skipValidation: true,
        slippagePercentage: slippage.toString()
      })
      .then((quoteResults) => {
        if (!quoteResults.length) {
          throw new Error("Failed to fetch quote from 0x");
        }
        return quoteResults[0];
      })
      .catch((e) => {
        throw e;
      });

    const buyAmount = buyToken.fromBlockchain(zeroXQuote.buyAmount);
    const usdValue = this.swapV2.getTokenUsd(buyToken).mul(buyAmount);

    const swapV2Quote: BeanSwapV2Quote = {
      sellToken: sellToken,
      sellAmount: amount,
      maxSellAmount: amount, // reverse not implemented yet.
      buyToken: buyToken,
      buyAmount: buyAmount,
      minBuyAmount: buyAmount.subSlippage(slippage),
      usd: usdValue,
      allowanceTarget: zeroXQuote.allowanceTarget,
      data: zeroXQuote.data,
      sourceType: "0x",
      sourceName: "0x",
      node: this,
      tag: `buy-${buyToken.symbol}`
    };

    ZeroXSwapNode.sdk.debug("[BeanSwapV2Quoter/quoteWith0x]: swapV2Quote: ", swapV2Quote);

    return swapV2Quote;
  }

  buildFromQuote({ quote }: BuildFromQuoteArgs): StepFunction<AdvancedPipePreparedResult> {
    this.validateQuote(quote);
    const swapStepFunction: StepFunction<AdvancedPipePreparedResult> = () => {
      return {
        name: `zeroXSwap`,
        amountOut: quote.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: quote.allowanceTarget,
          callData: quote.data as string,
          clipboard: undefined
        }),
        decode: () => undefined,
        decodeResult: () => undefined
      };
    };

    return swapStepFunction;
  }

  validateQuote(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "0x") {
      throw new Error("Invalid quote source type.");
    }

    if (!quote.data) {
      throw new Error("Invalid quote. Error finding 0x quote data.");
    }
  }
}

export class SwapV2WellNode extends SwapV2Node {
  readonly well: BasinWell;

  readonly amountOutCopySlot = 0;

  static readonly amountInPasteSlot = 2;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2, well: BasinWell) {
    super(sdk, swapV2);
    this.well = well;

    if (this.well.tokens.length !== 2) {
      throw new Error("Cannot configure well swap with non-pair wells");
    }

    this.name = `${this.well.name}-swapnode`;
  }

  /**
   * Constructs an AdvancedPipeCallStruct for well.getSwapOut
   * @param sellToken the token to sell
   * @param amount the amount of sellToken to sell
   */
  getSwapOutAdvancedPipeStruct(sellToken: ERC20Token, amount: TokenValue): AdvancedPipeCallStruct {
    return {
      target: this.well.address,
      callData: this.well.getContract().interface.encodeFunctionData("getSwapOut", [
        sellToken.address,
        this.getPairToken(sellToken).address,
        amount.toBlockchain()
      ]),
      clipboard: Clipboard.encode([])
    }
  }

  decodeGetSwapOut(result: string) {
    try {
      const decoded = this.well.getContract().interface.decodeFunctionResult("getSwapOut", result);
      return BigNumber.from(Array.isArray(decoded) ? decoded[0] : decoded);
    } catch (e) {
      console.error(`Error decoding getSwapOut for ${this.well.name}`, e);
      throw e;
    }
  }

  async getSwapOutQuote(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    slippage: number
  ): Promise<BeanSwapV2Quote> {
    const contract = this.well.getContract();

    const amountOut = await contract.callStatic
      .getSwapOut(sellToken.address, buyToken.address, amount.toBlockchain())
      .then((result) => buyToken.fromBlockchain(result));

    const usdValue = this.swapV2.getTokenUsd(buyToken).mul(amountOut);

    return {
      sellToken,
      sellAmount: amount,
      maxSellAmount: amount,
      buyToken,
      buyAmount: amountOut,
      minBuyAmount: amountOut.subSlippage(slippage),
      usd: usdValue,
      sourceType: "WELL",
      sourceName: this.well.name,
      allowanceTarget: this.well.address,
      node: this,
      tag: `buy-${buyToken.symbol}`
    };
  }

  buildFromQuote({ quote, copySlot }: BuildFromQuoteArgs): StepFunction<AdvancedPipePreparedResult> {
    this.validateQuote(quote);
    const { buyToken, sellToken, minBuyAmount, sellAmount } = quote;

    const swapStep: StepFunction<AdvancedPipePreparedResult> = (_amountInStep, runContext) => {
      const copyIndexTag = `buy-${sellToken.symbol}`;

      SwapV2WellNode.sdk.debug("[BeanSwapV2Node/buildFromQuote]: building swap step", { quote });

      return {
        name: `wellSwap-${sellToken.symbol}-${buyToken.symbol}`,
        amountOut: minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: this.well.address,
          callData: this.well.getContract().interface.encodeFunctionData("swapFrom", [
            sellToken.address,
            buyToken.address,
            sellAmount.toBlockchain(),
            minBuyAmount.toBlockchain(),
            SwapV2WellNode.sdk.contracts.pipeline.address,
            TokenValue.MAX_UINT256.toBlockchain()
          ]),
          clipboard: this.getClipboardFromRunContext(runContext, copyIndexTag, copySlot)
        }),
        decode: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data),
        decodeResult: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data)
      };
    };

    return swapStep;
  }

  private getClipboardFromRunContext(runContext: RunContext, tag: string, copySlot?: number) {
    let clipboard: string = Clipboard.encode([]);

    try {
      if (copySlot !== undefined) {
        const copyIndex = runContext.step.findTag(tag);
        if (copyIndex !== undefined && copyIndex !== null) {
          clipboard = Clipboard.encodeSlot(copyIndex, copySlot, SwapV2WellNode.amountInPasteSlot);
        }
      }
    } catch (e) {
      SwapV2WellNode.sdk.debug(`[BeanSwapV2Node/getClipboardFromContext]: no clipboard found for ${tag}`);
      // do nothing else. We only want to check the existence of the tag
    }

    return clipboard;
  }

  getPairToken(token: ERC20Token) {
    if (this.well.tokens.length !== 2) {
      throw new Error("Cannot configure well swap with non-pair wells");
    }

    const [token0, token1] = this.well.tokens;

    if (!token0.equals(token) && !token1.equals(token)) {
      throw new Error(`Invalid token. ${token.symbol} is not an underlying token of well ${this.well.name}`);
    }

    return token.equals(token0) ? token1 : token0;
  }

  validateQuote(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "WELL") {
      throw new Error("Invalid quote source type. Could not parse WELL quote.");
    }
  }
}

export class WrapEthNode extends SwapV2Node {
  name: string = "wrap-eth-swapnode";

  readonly amountOutCopySlot = undefined;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    super(sdk, swapV2);
  }

  async quote(sellToken: ERC20Token, amount: TokenValue): Promise<BeanSwapV2Quote> {
    if (!sellToken.equals(WrapEthNode.sdk.tokens.ETH)) {
      throw new Error(`Invalid sell token. Cannot wrap ${sellToken.symbol}. Expected ETH`);
    }

    return {
      sellToken,
      buyToken: WrapEthNode.sdk.tokens.WETH,
      maxSellAmount: amount,
      sellAmount: amount,
      buyAmount: amount,
      minBuyAmount: amount,
      usd: this.swapV2.getTokenUsd(WrapEthNode.sdk.tokens.WETH),
      sourceType: "WRAP_ETH",
      sourceName: this.name,
      allowanceTarget: WrapEthNode.sdk.contracts.beanstalk.address,
      node: this,
      tag: `buy-${WrapEthNode.sdk.tokens.WETH.symbol}`
    };
  }

  //

  buildFromQuote({ quote, toMode }: BuildFromQuoteArgs): StepClass<AdvancedPipePreparedResult> {
    this.validateQuote(quote);
    // const copyIndexTag = `buy-${WrapEthNode.sdk.tokens.ETH.symbol}`;

    return new WrapEthNode.sdk.farm.actions.WrapEth(toMode);

  }

  validateQuote(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "WRAP_ETH") {
      throw new Error("Invalid quote source type. Could not parse WRAP_ETH quote.");
    }
    if (
      quote.allowanceTarget.toLowerCase() !==
      WrapEthNode.sdk.contracts.beanstalk.address.toLowerCase()
    ) {
      throw new Error("Invalid allowance target. Expected Beanstalk contract address.");
    }
    if (!quote.sellToken.equals(WrapEthNode.sdk.tokens.ETH)) {
      throw new Error(`Invalid sell token. Cannot wrap ${quote.sellToken.symbol}. Expected ETH`);
    }
  }


  // return (_amountInStep, runContext) => {
  //   return {
  //     name: "wrapEth",
  //     amountOut: quote.buyAmount.toBigNumber(),
  //     value: quote.buyAmount.toBigNumber(),
  //     prepare: () => ({
  //       target: quote.allowanceTarget,
  //       callData: WrapEthNode.sdk.contracts.beanstalk.interface.encodeFunctionData("wrapEth", [
  //         quote.buyAmount.toBlockchain(),
  //         toMode || FarmToMode.EXTERNAL
  //       ]),
  //       clipboard: Clipboard.encode(
  //         this.getPasteParams(runContext, copyIndexTag, copySlot),
  //         quote.buyAmount.toBigNumber()
  //       )
  //     }),
  //     decode: (data: string) =>
  //       WrapEthNode.sdk.contracts.beanstalk.interface.decodeFunctionData("wrapEth", data),
  //     decodeResult: (result: string) =>
  //       WrapEthNode.sdk.contracts.beanstalk.interface.decodeFunctionResult("wrapEth", result)
  //   };
  // };

  // private getPasteParams(runContext: RunContext, tag: string, copyIndex?: number) {
  //   try {
  //     if (copyIndex !== undefined) {
  //       const returnDataIndex = runContext.step.findTag(tag);
  //       if (returnDataIndex !== undefined && returnDataIndex !== null) {
  //         return [returnDataIndex, copyIndex, WrapEthNode.amountInPasteSlot] as const;
  //       }
  //     }
  //   } catch (e) {
  //     SwapV2WellNode.sdk.debug(
  //       `[BeanSwapV2/WrapEthNode/getPasteParams]: no clipboard found for ${tag}`
  //     );
  //     // do nothing else. We only want to check the existence of the tag
  //   }
  //   return [];
  // }
  // }
}

export class UnwrapEthNode extends SwapV2Node {
  name: string = "unwrap-eth-swapnode";

  readonly amountOutCopySlot = undefined;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    super(sdk, swapV2);
  }

  async quote(sellToken: ERC20Token, amount: TokenValue): Promise<BeanSwapV2Quote> {
    if (!sellToken.equals(WrapEthNode.sdk.tokens.WETH)) {
      throw new Error(`Invalid sell token. Cannot unwrap ${sellToken.symbol}. Expected WETH`);
    }

    return {
      sellToken: WrapEthNode.sdk.tokens.WETH,
      buyToken: WrapEthNode.sdk.tokens.ETH,
      maxSellAmount: amount,
      sellAmount: amount,
      buyAmount: amount,
      minBuyAmount: amount,
      usd: this.swapV2.getTokenUsd(WrapEthNode.sdk.tokens.WETH),
      sourceType: "UNWRAP_ETH",
      sourceName: this.name,
      allowanceTarget: WrapEthNode.sdk.contracts.beanstalk.address,
      node: this,
      tag: `buy-${WrapEthNode.sdk.tokens.ETH.symbol}`
    };
  }

  buildFromQuote({ quote, fromMode }: BuildFromQuoteArgs): StepClass<AdvancedPipePreparedResult> {
    this.validateQuote(quote);

    return new UnwrapEthNode.sdk.farm.actions.UnwrapEth(fromMode);
  }

  validateQuote(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "UNWRAP_ETH") {
      throw new Error(
        `Invalid quote source type. Expected UNWRAP_ETH but got ${quote.sourceType}.`
      );
    }
  }
}
