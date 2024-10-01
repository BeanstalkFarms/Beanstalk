import { BeanSwapV2Quote, BeanSwapV2QuoterOptions, BeanSwapV2QuoterResult } from "./types";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token, NativeToken } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct } from "src/lib/depot";
import { SwapV2Node, SwapV2WellNode } from "./SwapV2Node";
import { BeanSwapV2 } from "./BeanSwapV2";

export class BeanSwapV2Quoter {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    BeanSwapV2Quoter.sdk = sdk;
    this.swapV2 = swapV2;
  }

  async getQuote(
    _sellToken: ERC20Token,
    _buyToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number,
    options?: BeanSwapV2QuoterOptions
  ) {
    const sellToken = this.ensureERC20(_sellToken);
    const buyToken = this.ensureERC20(_buyToken);

    if (_sellToken.equals(BeanSwapV2Quoter.sdk.tokens.ETH)) {
    }

    let result: BeanSwapV2QuoterResult | undefined;

    if (sellToken.equals(buyToken)) {
      result = undefined;
    } else if (sellToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      result = await this.quoteSellBeanForX(buyToken, amount, direction, slippage, options);
    } else if (buyToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      result = await this.quoteBuyBeanWithX(sellToken, amount, direction, slippage, options);
    } else {
      result = await this.quoteNonBean2NonBean(
        sellToken,
        buyToken,
        amount,
        direction,
        slippage,
        options
      );
    }

    return result;

    // assume we are swapping two non-bean tokens
  }

  private async quoteNonBean2NonBean(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number,
    _options?: BeanSwapV2QuoterOptions // TODO
  ) {
    if (sellToken.equals(buyToken)) {
      throw new Error(
        "[BeanSwapQuoterV2/quoteNonBean2NonBean]: sellToken and buyToken cannot be the same"
      );
    }

    const path: BeanSwapV2Quote[] = [];

    const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(
      sellToken,
      buyToken,
      amount,
      direction,
      slippage / 100
    );
    path.push(zeroXQuote);

    // const [wellQuotes, zeroXQuote] = await Promise.all([
    //   this.quoteDualStepWellSwap(sellToken, buyToken, amount, direction, slippage),
    //   this.swapV2.zeroXSwapNode.quote(sellToken, buyToken, amount, direction, slippage / 100)
    // ]);

    // if (!wellQuotes.length) {
    //   throw new Error("[BeanSwapQuoterV2/quoteNonBean2NonBean]: No well quotes found");
    // }

    // if (
    //   !wellQuotes.length ||
    //   wellQuotes[wellQuotes.length - 1].buyAmount.lt(zeroXQuote.buyAmount)
    // ) {
    //   path.push(zeroXQuote);
    // } else {
    //   path.push(...wellQuotes);
    // }

    const result = this.constructQuoteResult(path);

    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteNonBean2NonBean] RESULT: ", result);

    return result;
  }

  private async quoteSellBeanForX(
    buyToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number,
    _options?: BeanSwapV2QuoterOptions // TODO
  ): Promise<BeanSwapV2QuoterResult> {
    const sellToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    if (buyToken.equals(sellToken)) {
      throw new Error(
        "[BeanSwapQuoterV2/quoteSellBeanForX]: Expected buyToken to be a non-BEAN token"
      );
    }

    const path: BeanSwapV2Quote[] = [];

    // well quotes from BEAN => pairToken
    const wellQuotes = await this.quoteAllWellsFromBean(amount, direction, slippage);

    const directPath = wellQuotes.find((quote) => quote.buyToken.equals(buyToken));

    if (!wellQuotes.length) {
      throw new Error("[BeanSwapQuoterV2/quoteSellBeanForX]: No well quotes found");
    }
    if (!directPath) {
      throw new Error("[BeanSwapQuoterV2/quoteSellBeanForX]: Could not find direct Well Swap path");
    }

    const bestWellQuote = wellQuotes[0];

    BeanSwapV2Quoter.sdk.debug(
      "[BeanSwapQuoterV2/quoteSellBeanForX]: bestWellQuote",
      bestWellQuote
    );
    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteSellBeanForX]: directPath", directPath);

    // if no direct path or if the best well quote is not the direct path, fetch a zeroX quote
    if (!bestWellQuote.buyToken.equals(buyToken)) {
      const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(
        bestWellQuote.buyToken,
        buyToken,
        amount,
        "forward",
        slippage / 100
      );

      if (zeroXQuote.buyAmount.gt(directPath.buyAmount)) {
        path.push(bestWellQuote, zeroXQuote);
      }
    }

    if (!path.length) {
      path.push(directPath);
    }

    const result = this.constructQuoteResult(path);

    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteSellBeanForX] RESULT: ", result);

    return result;
  }

  /**
   * quote NON-bean token to BEAN
   * @param sellToken
   * @param amount
   * @param slippage
   * @returns
   */
  private async quoteBuyBeanWithX(
    sellToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number,
    _options?: BeanSwapV2QuoterOptions // TODO
  ): Promise<BeanSwapV2QuoterResult> {
    const buyToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    if (sellToken.equals(buyToken)) {
      throw new Error(
        "[BeanSwapV2Quoter/quoteBuyBeanWithX]: Expected sellToken to be a non-BEAN token"
      );
    }

    // well quotes from pairToken => BEAN
    const wellQuotes = await this.quoteAllWellsToBean(sellToken, amount, direction, slippage);
    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteBuyBeanWithX]: quotes: ", wellQuotes);

    if (!wellQuotes.length) {
      throw new Error("[BeanSwapV2Quoter/quoteBuyBeanWithX]: No well quotes found");
    }

    const directPath = wellQuotes.find((quote) => quote.sellToken.equals(sellToken));
    const bestWellQuote = wellQuotes[0];

    const path: BeanSwapV2Quote[] = [];

    const wellNode = this.swapV2.getWellNodeWithToken(bestWellQuote.sellToken);

    // If no direct path or the best well quote is not the direct path, fetch a zeroX quote
    if (!directPath || !bestWellQuote.sellToken.equals(sellToken)) {
      const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(
        sellToken,
        bestWellQuote.sellToken, // buyToken
        amount,
        "forward",
        slippage / 100
      );
      // wellQuotes were all approximations, so get a fresh quote from the Well w/ the 0x quote amountOut
      const postZeroXWellQuote = await wellNode.getSwapOutQuote(
        zeroXQuote.buyToken,
        buyToken,
        zeroXQuote.buyAmount,
        direction === "reverse",
        slippage
      );

      // If no direct path or zeroXQuote is better than directPath, use zeroXQuote
      if (!directPath || postZeroXWellQuote.buyAmount.gt(directPath.buyAmount)) {
        path.push(zeroXQuote, postZeroXWellQuote);
      }
    } else {
      path.push(directPath);
    }

    const result = this.constructQuoteResult(path);

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteBuyBeanWithX] RESULT: ", result);

    return result;
  }

  /**
   * Given an amount of BEAN, fetches quotes for all wells to buy BEAN.
   *
   * @param amount The amount of BEAN to sell
   * @returns an array of quotes sorted by buyAmount in non-increasing order
   */
  private async quoteAllWellsFromBean(
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number
  ) {
    const sellToken = BeanSwapV2Quoter.sdk.tokens.BEAN;
    const pipeCalls: AdvancedPipeCallStruct[] = [];

    const entries = [...this.swapV2.wellNodes.entries()];

    for (const [_, node] of entries) {
      const nodePipeCalls = node.constructQuotePipeCalls(sellToken, amount);
      pipeCalls.push(nodePipeCalls.forward);
    }

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsFromBean] Fetching quotes: ", {
      pipeCalls,
      sellToken,
      sellAmount: amount
    });

    const data = await BeanSwapV2Quoter.sdk.contracts.beanstalk.callStatic.advancedPipe(
      pipeCalls,
      "0"
    );

    BeanSwapV2Quoter.sdk.debug(
      "[BeanSwapV2Quoter/quoteAllWellsFromBean] AdvancedPipe response: ",
      data
    );

    const quotes = entries.map<BeanSwapV2Quote>(([well, node], i) => {
      const amountOut = node.decodeQuote(data[i], direction);
      const buyToken = node.getPairToken(sellToken);
      const price = this.swapV2.getTokenUsd(buyToken);

      return {
        sellToken: sellToken,
        sellAmount: amount,
        maxSellAmount: amount,
        buyToken: buyToken,
        buyAmount: buyToken.fromBlockchain(amountOut),
        minBuyAmount: buyToken.fromBlockchain(amountOut).subSlippage(slippage),
        usd: buyToken.fromBlockchain(amountOut).mul(price),
        sourceType: "WELL",
        sourceName: well.name,
        allowanceTarget: well.address,
        isReverse: direction === "reverse",
        node,
        tag: `buy-${buyToken.symbol}`
      };
    });

    if (!quotes.length) {
      throw new Error("[BeanSwapV2Quoter/allWellsQuote]: Could not determine best Well Swap quote");
    }

    quotes.sort((a, b) => b.buyAmount.sub(a.buyAmount).toNumber());

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsFromBean] RESULT", quotes);

    return quotes;
  }

  /**
   * Given the sell token & amount, fetches quotes for all wells to buy BEAN.
   * @note Determines the approximate sell amount for each non-bean token of a well using the USD price as a medium.
   *
   * @param sellToken
   * @param amount
   * @returns quotes sorted by buyAmount in non-increasing order
   */
  private async quoteAllWellsToBean(
    sellToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number
  ) {
    if (sellToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      return [];
    }

    const pipeCalls: AdvancedPipeCallStruct[] = [];
    const entries = [...this.swapV2.wellNodes.entries()];

    const buyToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    const swapEstimates: {
      token: ERC20Token;
      amount: TokenValue;
    }[] = [];

    for (const [_, node] of entries) {
      const pairToken = node.getPairToken(buyToken);
      const estAmountOut = this.approximate0xOut(sellToken, amount, pairToken, slippage);
      const nodePipeCalls = node.constructQuotePipeCalls(pairToken, estAmountOut);

      swapEstimates.push({ token: pairToken, amount: estAmountOut });
      pipeCalls.push(nodePipeCalls.forward);
    }

    BeanSwapV2Quoter.sdk.debug(
      "[BeanSwapV2Quoter/quoteAllWellsToBean] Fetching quotes: ",
      sellToken,
      buyToken,
      pipeCalls
    );

    const data = await BeanSwapV2Quoter.sdk.contracts.beanstalk.callStatic.advancedPipe(
      pipeCalls,
      "0"
    );

    BeanSwapV2Quoter.sdk.debug(
      "[BeanSwapV2Quoter/quoteAllWellsToBean] AdvancedPipe response: ",
      data
    );

    const quotes = entries.map<BeanSwapV2Quote>(([well, node], i) => {
      const amountOut = node.decodeQuote(data[i], "forward");
      const swapEstimate = swapEstimates[i];

      return {
        sellToken: swapEstimate.token,
        sellAmount: swapEstimate.amount,
        maxSellAmount: swapEstimate.amount,
        buyToken: buyToken,
        buyAmount: buyToken.fromBlockchain(amountOut),
        minBuyAmount: buyToken.fromBlockchain(amountOut).subSlippage(slippage),
        usd: TokenValue.ZERO,
        sourceType: "WELL",
        sourceName: well.name,
        allowanceTarget: well.address,
        isReverse: direction === "reverse",
        node,
        tag: `buy-${buyToken.symbol}`
      };
    });
    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsToBean]: Quote result", {
      quotes
    });

    if (!quotes.length) {
      throw new Error("[BeanSwapV2Quoter/allWellsQuote]: Could not determine best Well Swap quote");
    }

    quotes.sort((a, b) => b.buyAmount.sub(a.buyAmount).toNumber());

    return quotes;
  }

  // /**
  //  * TODO: // fix me
  //  * Quotes a multi-step well swap.
  //  * @param sellToken
  //  * @param buyToken
  //  * @param amount
  //  * @returns
  //  */
  // private quoteDualStepWellSwap(
  //   sellToken: ERC20Token,
  //   buyToken: ERC20Token,
  //   amount: TokenValue,
  //   direction: "forward" | "reverse",
  //   slippage: number
  // ): Promise<BeanSwapV2Quote[]> {
  //   const isReverse = direction === "reverse";

  //   const inputWellNode = this.swapV2.getWellNodeWithToken(sellToken);
  //   const outputWellNode = this.swapV2.getWellNodeWithToken(buyToken);

  //   BeanSwapV2Quoter.sdk.debug(
  //     "[BeanSwapV2Quoter/quoteDualStepWellSwap] Fetching quotes: ",
  //     sellToken,
  //     buyToken
  //   );

  //   const promise1 = (amt: TokenValue) =>
  //     inputWellNode.getSwapOutQuote(
  //       sellToken,
  //       inputWellNode.getPairToken(sellToken),
  //       amt,
  //       isReverse,
  //       slippage
  //     );

  //   const promise2 = (amt: TokenValue) =>
  //     outputWellNode.getSwapOutQuote(
  //       outputWellNode.getPairToken(buyToken),
  //       buyToken,
  //       amt,
  //       isReverse,
  //       slippage
  //     );

  //   const quoteFns = [promise1, promise2];
  //   if (isReverse) {
  //     quoteFns.reverse();
  //   }

  //   return promise1(amount).then(async (response0) => {
  //     const response1 = await promise2(amount);

  //     BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteDualStepWellSwap] Quote response: ", [
  //       response0,
  //       response1
  //     ]);

  //     return [response0, response1];
  //   });
  // }

  /**
   * Approximates the sell amount for a token pair in a swap operation via 0x.
   * @param sellToken The token being sold
   * @param sellAmount The amount of sellToken to be sold
   * @param buyToken The token to be bought
   * @param slippage The maximum acceptable slippage for the swap
   * @returns The approximates min amount of buyToken that can be received via non-well swap - fees and slippage
   *
   * @note We approximate the fee for any give swap to be 0.03%.
   *
   * This function calculates the approximate amount of buyToken that can be received
   * when selling a specific amount of sellToken, based on their respective USD prices.
   *
   * For example, given the following parameters:
   * - sellToken = USDC
   * - sellAmount = 3000 USDC
   * - buyToken = WETH
   * - slippage = 0.05
   *
   * If WETH USD price = 3000 & USDC USD price = 1, then:
   * 1. Calculate relative USD value: (1 USD / 3000 USD) = 0.0003333
   * 2. Multiply by sell amount: 0.0003333 * 3000 = 1
   * 3. Subtract slippage: 1 - 0.05 slippage = 0.9995 WETH
   * 4. Subtract fees: Fee = (0.9995 * 0.05%) = 0.9995 - 0.00049975 = 0.99900025 WETH
   *
   * The function would return approximately 1 WETH.
   *
   * Note: This is an approximation and does not account for slippage, fees, or
   * the actual liquidity in the pool, which may affect the real swap outcome.
   */
  approximate0xOut(
    fromToken: ERC20Token,
    amount: TokenValue,
    toToken: ERC20Token,
    slippage: number
  ) {
    const fromTokenUsd = this.swapV2.getTokenUsd(fromToken);
    const toTokenUsd = this.swapV2.getTokenUsd(toToken);
    const relativeUsd = fromTokenUsd.div(toTokenUsd);

    const pairTokenAmount = toToken.fromHuman(relativeUsd.mul(amount).toHuman());

    const amountLessFees = 1 - 0.0003;
    return pairTokenAmount.subSlippage(slippage).mul(amountLessFees);
  }

  private constructQuoteResult(quotes: BeanSwapV2Quote | BeanSwapV2Quote[]) {
    const quoteArray = Array.isArray(quotes) ? quotes : [quotes];

    if (!quoteArray.length) {
      throw new Error("BeanSwapV2Quoter: No quotes provided");
    }

    const lastQuote = quoteArray[quoteArray.length - 1];
    const firstQuote = quoteArray[0];

    const result: BeanSwapV2QuoterResult = {
      sellToken: firstQuote.sellToken,
      sellAmount: firstQuote.sellAmount,
      buyToken: lastQuote.buyToken,
      buyAmount: lastQuote.buyAmount,
      minAmountOut: lastQuote.minBuyAmount,
      usd: lastQuote.usd,
      path: quoteArray
    };

    return result;
  }

  private ensureERC20(token: ERC20Token | NativeToken): ERC20Token {
    if (token instanceof NativeToken) {
      return BeanSwapV2Quoter.sdk.tokens.WETH;
    }
    return token;
  }
}
