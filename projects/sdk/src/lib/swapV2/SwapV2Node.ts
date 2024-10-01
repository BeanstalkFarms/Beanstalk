import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ERC20Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { BeanSwapV2Quote, SwapV2Direction } from "./types";
import { BigNumber, ethers } from "ethers";
import { BeanSwapV2 } from "./BeanSwapV2";
import { ClipboardSettings } from "src/types";
import { RunContext, Step, StepClass, StepFunction } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "../depot/pipe";
import { ZeroExQuoteResponse } from "../matcha";
import { FarmFromMode, FarmToMode } from "../farm";

export abstract class SwapV2Node {
  name: string;

  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  abstract amountOutCopySlot: number;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    SwapV2Node.sdk = sdk;
    this.swapV2 = swapV2;
  }

  abstract validateQuote(quote: BeanSwapV2Quote): void;

  abstract buildFromQuote(
    quote: BeanSwapV2Quote,
    copySlot?: number,
    modes?: {
      from?: FarmFromMode;
      to?: FarmToMode;
    }
  ): StepFunction<AdvancedPipePreparedResult> | StepClass<AdvancedPipePreparedResult>;

  buildPipelineApprovalStepFromQuote(quote: BeanSwapV2Quote, amount: BigNumber) {
    const approvalStepFunction: StepFunction<AdvancedPipePreparedResult> = (_amountInStep) => {
      const contract = quote.sellToken.getContract();

      return {
        name: "approve",
        amountOut: quote.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: quote.sellToken.address,
          callData: contract.interface.encodeFunctionData("approve", [
            quote.allowanceTarget,
            amount
          ]),
          clipboard: ethers.constants.HashZero
        }),
        decode: () => undefined,
        decodeResult: () => undefined
      };
    };

    return approvalStepFunction;
  }

  protected getClipboard(context: RunContext, clipboard?: ClipboardSettings) {
    if (!clipboard) return undefined;

    return Clipboard.encodeSlot(
      context.step.findTag(clipboard.tag),
      clipboard.copySlot,
      clipboard.pasteSlot
    );
  }

  toJSON() {
    return {
      amountOutCopySlot: this.amountOutCopySlot
    };
  }
}

export class ZeroXSwapNode extends SwapV2Node {
  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    super(sdk, swapV2);
    this.name = "0x-swapnode";
  }

  readonly amountOutCopySlot = 0;

  async quote(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number
  ) {
    if (sellToken.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw new Error("[BeanSwapV2Quoter/quoteWith0x]: expected sellToken to be a non-BEAN token");
    }
    if (buyToken.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw new Error("[BeanSwapV2Quoter/quoteWith0x]: expected buyToken to be a non-BEAN token");
    }

    const isReverse = direction === "reverse";

    let zeroXQuote: ZeroExQuoteResponse | null = null;

    const maxRetries = 3;
    const delay = 500; // milliseconds

    const sellAmount = direction === "forward" ? amount.toBigNumber() : undefined;
    const buyAmount = direction === "reverse" ? amount.toBigNumber() : undefined;

    for (let iterations = 0; iterations < maxRetries; iterations++) {
      try {
        const [quote] = await ZeroXSwapNode.sdk.zeroX.quote({
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: sellAmount?.toString(),
          buyAmount: buyAmount?.toString(),
          takerAddress: ZeroXSwapNode.sdk.contracts.pipeline.address,
          shouldSellEntireBalance: true,
          skipValidation: true,
          slippagePercentage: slippage.toString()
        });
        zeroXQuote = quote;
        break;
      } catch (e) {
        if (iterations === maxRetries - 1) throw e;
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    if (!zeroXQuote) {
      throw new Error("[BeanSwapV2Quoter/zeroXQuote]: Failed to fetch 0x quote");
    }

    const zeroXOutAmount = direction === "forward" ? zeroXQuote.buyAmount : zeroXQuote.sellAmount;
    const outToken = direction === "forward" ? buyToken : sellToken;

    const outTokenUsd = this.swapV2.getTokenUsd(outToken);

    const outAmount = outToken.fromBlockchain(zeroXOutAmount);
    const minAmountOut = outAmount.subSlippage(slippage);

    const swapV2Quote: BeanSwapV2Quote = {
      sellToken: sellToken,
      sellAmount: isReverse ? sellToken.fromBlockchain(zeroXQuote.sellAmount) : amount,
      maxSellAmount: isReverse ? sellToken.fromBlockchain(zeroXQuote.sellAmount) : amount,
      buyToken: buyToken,
      buyAmount: isReverse ? amount : buyToken.fromBlockchain(zeroXQuote.buyAmount),
      minBuyAmount: isReverse ? amount : minAmountOut,
      usd: outTokenUsd,
      allowanceTarget: zeroXQuote.allowanceTarget,
      data: zeroXQuote.data,
      sourceType: "0x",
      sourceName: "0x",
      isReverse: direction === "reverse",
      node: this,
      tag: `buy-${buyToken.symbol}`
    };

    ZeroXSwapNode.sdk.debug("[BeanSwapV2Quoter/quoteWith0x]: swapV2Quote: ", swapV2Quote);

    return swapV2Quote;
  }

  buildFromQuote(quote: BeanSwapV2Quote): StepFunction<AdvancedPipePreparedResult> {
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
      throw new Error("Invalid quote source type. Could not parse WELL quote.");
    }

    if (!quote.data) {
      throw new Error("Could not find swap quote data from 0x");
    }
  }
}

export class SwapV2WellNode extends SwapV2Node {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  readonly well: BasinWell;

  readonly tokens: ERC20Token[];

  readonly amountOutCopySlot = 0;

  readonly forwardAmountInPasteSlot = 2;

  readonly reverseAmountInPasteSlot = 3;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2, well: BasinWell) {
    super(sdk, swapV2);

    this.well = well;

    if (this.well.tokens.length !== 2) {
      throw new Error("Cannot configure well swap with non-pair wells");
    }

    this.tokens = this.well.tokens;

    this.name = `${this.well.name}-swapnode`;
  }

  constructQuotePipeCalls(sellToken: ERC20Token, amount: TokenValue) {
    const contract = this.well.getContract();
    const buyToken = this.getPairToken(sellToken);

    const shared = {
      target: this.well.address,
      clipboard: ethers.constants.HashZero
    };

    const forwardEncoded = contract.interface.encodeFunctionData("getSwapOut", [
      sellToken.address,
      buyToken.address,
      amount.toBlockchain()
    ]);

    const reverseEncoded = contract.interface.encodeFunctionData("getSwapIn", [
      sellToken.address,
      buyToken.address,
      amount.toBlockchain()
    ]);

    const datas = {
      forward: {
        ...shared,
        callData: forwardEncoded
      } as AdvancedPipeCallStruct,
      reverse: {
        ...shared,
        callData: reverseEncoded
      } as AdvancedPipeCallStruct
    };

    return datas;
  }

  decodeQuote(result: string, direction: SwapV2Direction) {
    try {
      if (direction === "forward") {
        return this.well
          .getContract()
          .interface.decodeFunctionResult("getSwapOut", result)[0] as BigNumber;
      }
      return this.well
        .getContract()
        .interface.decodeFunctionResult("getSwapIn", result)[0] as BigNumber;
    } catch (e) {
      const fnName = direction === "forward" ? "getSwapOut" : "getSwapIn";
      console.error(`Error decoding ${fnName} for ${this.well.name}`, e);
      throw e;
    }
  }

  async getSwapOutQuote(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    isReverse: boolean,
    slippage: number
  ): Promise<BeanSwapV2Quote> {
    const contract = this.well.getContract();

    let amountOut: TokenValue;
    if (isReverse) {
      amountOut = await contract.callStatic
        .getSwapIn(sellToken.address, buyToken.address, amount.toBlockchain())
        .then((result) => sellToken.fromBlockchain(result));
    } else {
      amountOut = await contract.callStatic
        .getSwapOut(sellToken.address, buyToken.address, amount.toBlockchain())
        .then((result) => buyToken.fromBlockchain(result));
    }

    return {
      sellToken,
      sellAmount: isReverse ? amountOut : amount,
      maxSellAmount: isReverse ? amountOut.addSlippage(slippage) : amount,
      buyToken,
      buyAmount: isReverse ? amount : amountOut,
      minBuyAmount: isReverse ? amount : amountOut.subSlippage(slippage),
      usd: this.swapV2.getTokenUsd(buyToken),
      sourceType: "WELL",
      sourceName: this.well.name,
      allowanceTarget: this.well.address,
      isReverse,
      node: this,
      tag: `buy-${buyToken.symbol}`
    };
  }

  buildFromQuote(
    quote: BeanSwapV2Quote,
    copySlot?: number
  ): StepFunction<AdvancedPipePreparedResult> {
    this.validateQuote(quote);
    const { buyToken, sellToken, minBuyAmount, buyAmount, maxSellAmount, isReverse, sellAmount } =
      quote;

    const minAmountOut = isReverse ? minBuyAmount : maxSellAmount;

    const swapStep: StepFunction<AdvancedPipePreparedResult> = (_amountInStep, runContext) => {
      const iWell = this.well.getContract().interface;

      let clipboard: string | undefined;

      try {
        if (copySlot !== undefined) {
          const copyIndex = runContext.step.findTag(`buy-${sellToken.symbol}`);
          clipboard = copyIndex
            ? Clipboard.encodeSlot(
                copyIndex,
                copySlot,
                isReverse ? this.reverseAmountInPasteSlot : this.forwardAmountInPasteSlot
              )
            : undefined;
        }
      } catch (e) {
        SwapV2WellNode.sdk.debug(
          `[BeanSwapV2Node/buildFromQuote/${sellToken.symbol} => ${buyToken.symbol}]: no clipboard found for buy-${sellToken.symbol}`
        );
        // do nothing else. We only want to check the existence of the tag
      }

      SwapV2WellNode.sdk.debug("[BeanSwapV2Node/buildFromQuote]: building swap step", {
        quote
      });

      const callData = isReverse
        ? iWell.encodeFunctionData("swapTo", [
            sellToken.address,
            buyToken.address,
            maxSellAmount.toBlockchain(),
            buyAmount.toBlockchain(),
            SwapV2WellNode.sdk.contracts.pipeline.address, // always transfer to pipeline
            TokenValue.MAX_UINT256.toBlockchain()
          ])
        : iWell.encodeFunctionData("swapFrom", [
            sellToken.address,
            buyToken.address,
            sellAmount.toBlockchain(),
            minBuyAmount.toBlockchain(),
            SwapV2WellNode.sdk.contracts.pipeline.address, // always transfer to pipeline
            TokenValue.MAX_UINT256.toBlockchain()
          ]);

      return {
        name: `wellSwap-${sellToken.symbol}-${buyToken.symbol}`,
        amountOut: minAmountOut.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: this.well.address,
          callData: callData,
          clipboard
        }),
        decode: (data: string) => iWell.decodeFunctionResult("swapFrom", data),
        decodeResult: (data: string) => iWell.decodeFunctionResult("swapFrom", data)
      };
    };

    return swapStep;
  }

  getPairToken(token: ERC20Token) {
    if (token.equals(this.tokens[0])) return this.tokens[1];
    return this.tokens[0];
  }

  validateQuote(quote: BeanSwapV2Quote) {
    if (quote.sourceType !== "WELL") {
      throw new Error("Invalid quote source type. Could not parse WELL quote.");
    }
  }
}

// export class WrapEthNode extends SwapV2Node {
//   constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
//     super(sdk, swapV2);
//   }

//   readonly amountOutCopySlot = 0;

//   async quote(sellToken: ERC20Token, amount: TokenValue): Promise<BeanSwapV2Quote> {
//     if (!sellToken.equals(WrapEthNode.sdk.tokens.ETH)) {
//       throw new Error("Invalid sell token. Expected ETH");
//     }

//     return {
//       sellToken,
//       buyToken: WrapEthNode.sdk.tokens.WETH,
//       maxSellAmount: amount,
//       sellAmount: amount,
//       buyAmount: amount,
//       minBuyAmount: amount,
//       usd: this.swapV2.getTokenUsd(WrapEthNode.sdk.tokens.WETH),
//       sourceType: "WRAP_UNWRAP_ETH",
//       sourceName: "WRAP_UNWRAP_ETH",
//       allowanceTarget: WrapEthNode.sdk.contracts.beanstalk.address,
//       isReverse: false,
//       node: this,
//       tag: `buy-${WrapEthNode.sdk.tokens.WETH.symbol}`
//     };
//   }

//   buildFromQuote(
//     quote: BeanSwapV2Quote,
//     copySlot?: number
//   ): StepFunction<AdvancedPipePreparedResult> {
//     return async (_amountInStep, runContext) => {
//       this.validateQuote(quote);
//       const { sellToken, buyToken } = quote;

//       let clipboard: string | undefined;

//       try {
//         if (copySlot !== undefined) {
//           const clip = runContext.step.findTag(`buy-${sellToken.symbol}`);
//           clipboard = clip ? Clipboard.encodeSlot(clip, copySlot, 0) : undefined;
//         }
//       } catch (e) {
//         SwapV2WellNode.sdk.debug(
//           `[BeanSwapV2Node/buildFromQuote/${sellToken.symbol} => ${buyToken.symbol}]: no clipboard found for buy-${sellToken.symbol}`
//         );
//         // do nothing else. We only want to check the existence of the tag
//       }

//       return {
//         name: "wrapUnwrapEth",
//         amountOut: quote.buyAmount.toBigNumber(),
//         value: BigNumber.from(0),
//         prepare: () => ({
//           target: quote.allowanceTarget,
//           callData: quote.data as string,
//           clipboard: undefined
//         }),
//         decode: () => undefined,
//         decodeResult: () => undefined
//       };
//     };
//   }

//   validateQuote(quote: BeanSwapV2Quote) {
//     if (quote.sourceType !== "WRAP_UNWRAP_ETH") {
//       throw new Error("Invalid quote source type. Could not parse WRAP_UNWRAP_ETH quote.");
//     }
//   }
// }

// export class UnwrapEthNode extends SwapV2Node {
//   constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
//     super(sdk, swapV2);
//   }

//   readonly amountOutCopySlot = 0;

//   quote(fromMode: FarmFromMode) {
//     return new UnwrapEthNode.sdk.farm.actions.UnwrapEth(fromMode);
//   }

//   buildFromQuote(quote: BeanSwapV2Quote, copySlot?: number): StepClass<AdvancedPipePreparedResult> {
//     this.validateQuote(quote);

//     return new UnwrapEthNode.sdk.farm.actions.UnwrapEth();
//   }

//   validateQuote(quote: BeanSwapV2Quote) {
//     if (quote.sourceType !== "WRAP_UNWRAP_ETH") {
//       throw new Error("Invalid quote source type. Could not parse WRAP_UNWRAP_ETH quote.");
//     }
//   }
// }
