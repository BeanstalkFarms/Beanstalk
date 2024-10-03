import { BeanSwapV2Quote, SwapApproximation } from "./types";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token,  Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct } from "src/lib/depot";
import { BeanSwapV2 } from "./BeanSwapV2";

export class BeanSwapV2Quoter {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    BeanSwapV2Quoter.sdk = sdk;
    this.swapV2 = swapV2;
  }

  async getQuote(_sellToken: ERC20Token, _buyToken: ERC20Token, amount: TokenValue, slippage: number) {
    const sellToken = this.ensureERC20(_sellToken);
    const buyToken = this.ensureERC20(_buyToken);

    const quotes: BeanSwapV2Quote[] = [];

    /**
     * Unwrap should only be a single action or the last action
     * This handles the case where it is a single swap action.
     */
    if (
      _sellToken.equals(BeanSwapV2Quoter.sdk.tokens.WETH) &&
      _buyToken.equals(BeanSwapV2Quoter.sdk.tokens.ETH)
    ) {
      const unwrapQuote = await this.swapV2.unwrapEthNode.quote(_buyToken, amount);
      return [unwrapQuote];
    }

    // If our input token is ETH, add the wrap step.
    if (_sellToken.equals(BeanSwapV2Quoter.sdk.tokens.ETH)) {
      const wrapQuote = await this.swapV2.wrapEthNode.quote(_sellToken, amount);
      quotes.push(wrapQuote);
    }

    let path: BeanSwapV2Quote[];

    // this will catch any swaps that are only wrap / unwrap
    if (sellToken.equals(buyToken)) {
      path = [];
    } else if (sellToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      path = await this.quoteSellBeanForX(buyToken, amount, slippage);
    } else if (buyToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      path = await this.quoteBuyBeanWithX(sellToken, amount, slippage);
    } else {
      path = await this.quoteNonBeanSwap(sellToken, buyToken, amount, slippage);
    }

    quotes.push(...path);

    // Only add the unwrap step if the _sellToken is NOT WETH. If it is WETH, it'll be handled above.
    if (!_sellToken.equals(BeanSwapV2Quoter.sdk.tokens.WETH) && _buyToken.equals(BeanSwapV2Quoter.sdk.tokens.ETH)) {
      const lastPathBuyToken = path[path.length - 1].buyToken;
      if (!BeanSwapV2Quoter.sdk.tokens.WETH.equals(lastPathBuyToken)) {
        throw new Error(`Error constructing swap quote. Expected last quote to be WETH, but got ${lastPathBuyToken.symbol}`);
      }

      const unwrapQuote = await this.swapV2.unwrapEthNode.quote(lastPathBuyToken as ERC20Token, amount);
      quotes.push(unwrapQuote);
    }

    return path;
  }

  // TODO: Eventually provide Well1 => BEAN => Well2
  private async quoteNonBeanSwap(sellToken: ERC20Token, buyToken: ERC20Token, amount: TokenValue, slippage: number) {
    if (sellToken.equals(buyToken)) {
      throw new Error('Invalid swap path. SellToken and BuyToken cannot be the same');
    }

    const path: BeanSwapV2Quote[] = [];
  
    const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(sellToken, buyToken, amount, slippage / 100);
    path.push(zeroXQuote);

    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteNonBean2NonBean] path: ", path);

    return path;
  }

  private async quoteSellBeanForX(buyToken: ERC20Token, amount: TokenValue, slippage: number): Promise<BeanSwapV2Quote[]> {
    const sellToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    if (buyToken.equals(sellToken)) {
      throw new Error("Expected buyToken to be a non-BEAN token");
    }

    const path: BeanSwapV2Quote[] = [];
    // well quotes from BEAN => pairToken
    const wellQuotes = await this.quoteAllWellsBean2X(amount, slippage);
    const directPath = wellQuotes.find((quote) => buyToken.equals(quote.buyToken));

    if (!wellQuotes.length) {
      throw new Error("Error finding well routes. No well quotes found");
    }

    const bestWellQuote = wellQuotes[0];

    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteSellBeanForX]: bestWellQuote", bestWellQuote);
    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteSellBeanForX]: directPath", directPath);

    // if no direct path or if the best well quote is not the direct path, fetch a zeroX quote
    if (!directPath || !buyToken.equals(bestWellQuote.buyToken)) {
      const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(
        bestWellQuote.buyToken as ERC20Token,
        buyToken,
        amount,
        slippage / 100
      );

      if (zeroXQuote.buyAmount.gt(directPath?.buyAmount || 0)) {
        path.push(bestWellQuote, zeroXQuote);
      }
    }

    if (!path.length && directPath) {
      path.push(directPath);
    }

    BeanSwapV2Quoter.sdk.debug("[BeanSwapQuoterV2/quoteSellBeanForX] path: ", path);

    return path;
  }

  /**
   * quote NON-bean token to BEAN
   * @param sellToken
   * @param amount
   * @param slippage
   * @returns
   */
  private async quoteBuyBeanWithX(sellToken: ERC20Token, amount: TokenValue, slippage: number): Promise<BeanSwapV2Quote[]> {
    const buyToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    if (sellToken.equals(buyToken)) {
      throw new Error("Error determing best well to buy BEAN. Expected sellToken to be a non-BEAN token");
    }

    // well quotes from pairToken => BEAN
    const wellQuotes = await this.quoteAllWellsX2Bean(sellToken, amount, slippage);
    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteBuyBeanWithX]: quotes: ", wellQuotes);

    if (!wellQuotes.length) {
      throw new Error("Error determining swap path. No well quotes found");
    }

    const directPath = wellQuotes.find((quote) => sellToken.equals(quote.sellToken));
    const bestWellQuote = wellQuotes[0];

    const path: BeanSwapV2Quote[] = [];

    const wellNode = this.swapV2.getWellNodeWithToken(bestWellQuote.sellToken as ERC20Token);

    if (!wellNode) {
      throw new Error("Could not find well node");
    }

    // If no direct path or the best well quote is not the direct path, fetch a zeroX quote
    if (!directPath || !sellToken.equals(bestWellQuote.sellToken)) {
      const zeroXQuote = await this.swapV2.zeroXSwapNode.quote(
        sellToken,
        bestWellQuote.sellToken as ERC20Token, // buyToken
        amount,
        slippage / 100
      );
      // wellQuotes were all approximations, so get a fresh quote from the Well w/ the 0x quote amountOut
      const postZeroXWellQuote = await wellNode.getSwapOutQuote(
        zeroXQuote.buyToken as ERC20Token,
        buyToken,
        zeroXQuote.buyAmount,
        slippage
      );

      // If no direct path or zeroXQuote is better than directPath, use zeroXQuote
      if (!directPath || postZeroXWellQuote.buyAmount.gt(directPath.buyAmount)) {
        path.push(zeroXQuote, postZeroXWellQuote);
      }
    } else {
      path.push(directPath);
    }

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteBuyBeanWithX] RESULT: ", path);

    return path;
  }

  /**
   * Given an amount of BEAN, fetches quotes for all wells to sell BEAN.
   *
   * @param amount The amount of BEAN to sell
   * @returns an array of well quotes sorted by USD value in non-increasing order
   */
  private async quoteAllWellsBean2X(amount: TokenValue, slippage: number) {
    const sellToken = BeanSwapV2Quoter.sdk.tokens.BEAN;
    const pipeCalls: AdvancedPipeCallStruct[] = [];

    const entries = [...this.swapV2.getWellNodes().entries()];

    for (const [_, node] of entries) {
      const nodePipeCalls = node.getSwapOutAdvancedPipeStruct(sellToken, amount);
      pipeCalls.push(nodePipeCalls);
    }

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsFromBean] Fetching quotes: ", {
      pipeCalls,
      sellToken,
      sellAmount: amount
    });

    const data = await BeanSwapV2Quoter.sdk.contracts.beanstalk.callStatic.advancedPipe(pipeCalls, "0");

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsFromBean] AdvancedPipe response: ", data);

    const quotes = entries.map<BeanSwapV2Quote>(([well, node], i) => {
      // Non-BEAN token we are buying by selling BEAN
      const buyToken = node.getPairToken(sellToken);

      // The amount of non-BEAN token received from well.getSwapOut
      const buyAmount = buyToken.fromBlockchain(node.decodeGetSwapOut(data[i]));

      // The USD value of the non-BEAN token received
      const usdValue = this.swapV2.getTokenUsd(buyToken).mul(buyAmount);

      return {
        sellToken,
        sellAmount: amount,
        maxSellAmount: amount,
        buyToken,
        buyAmount,
        minBuyAmount: buyAmount.subSlippage(slippage),
        usd: usdValue,
        sourceType: "WELL",
        sourceName: node.name,
        allowanceTarget: well.address,
        node,
        tag: `buy-${buyToken.symbol}`
      };
    });

    // Should never happen, but sanity check.
    if (!quotes.length) {
      throw new Error("Error determining route to sell BEAN. No quotes found");
    }

    quotes.sort((a, b) => b.usd.sub(a.usd).toNumber());

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
  private async quoteAllWellsX2Bean(sellToken: ERC20Token, amount: TokenValue, slippage: number) {
    if (sellToken.equals(BeanSwapV2Quoter.sdk.tokens.BEAN)) {
      throw new Error("Cannot determine best well to buy BEAN. Expected sellToken to be a non-BEAN token");
    }

    const entries = [...this.swapV2.getWellNodes().entries()];
    const buyToken = BeanSwapV2Quoter.sdk.tokens.BEAN;

    const pipeCalls: AdvancedPipeCallStruct[] = [];

    const swapEstimates: {
      swapToken: ERC20Token; // The non-bean token post 0x swap to sell for BEAN
      estimate: SwapApproximation;
    }[] = [];

    for (const [_, node] of entries) {
      // the non-bean token in the well.
      const swapToken = node.getPairToken(buyToken);

      // the approximate amounts of the non-bean token we will get if we swap sellToken for nonBeanPair
      const estimate = this.approximate0xOut(sellToken, swapToken, amount, slippage);

      // construct well.getSwapOut for nonBeanPair => BEAN
      const nodePipeCalls = node.getSwapOutAdvancedPipeStruct(swapToken, estimate.minAmountOut);

      swapEstimates.push({ swapToken, estimate });
      pipeCalls.push(nodePipeCalls);
    }

    BeanSwapV2Quoter.sdk.debug(
      "[BeanSwapV2Quoter/quoteAllWellsX2Bean] Fetching quotes: ",
      sellToken,
      buyToken,
      swapEstimates,
      pipeCalls
    );

    const data = await BeanSwapV2Quoter.sdk.contracts.beanstalk.callStatic.advancedPipe(pipeCalls, "0");

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsX2Bean] AdvancedPipe response: ", data);

    const quotes: BeanSwapV2Quote[] = [];

    for (const [i, [well, node]] of entries.entries()) {
      const { swapToken, estimate } = swapEstimates[i];

      // Should never happen, but sanity check.
      if (!estimate || !swapToken) {
        continue;
      }

      // The amount of BEAN received from well.getSwapOut
      const decodedAmountOut = node.decodeGetSwapOut(data[i]);
      const buyAmount = buyToken.fromBlockchain(decodedAmountOut);

      const quote: BeanSwapV2Quote = {
        sellToken: swapToken,
        sellAmount: estimate.minAmountOut,
        maxSellAmount: estimate.maxAmountOut,
        buyToken,
        buyAmount,
        minBuyAmount: buyAmount.subSlippage(slippage),
        usd: TokenValue.ZERO,
        sourceType: "WELL",
        sourceName: well.name,
        allowanceTarget: well.address,
        node,
        tag: `buy-${buyToken.symbol}`
      };

      quotes.push(quote);
    }

    BeanSwapV2Quoter.sdk.debug("[BeanSwapV2Quoter/quoteAllWellsX2Bean]: Quote result", {
      quotes
    });

    if (!quotes.length) {
      throw new Error("[BeanSwapV2Quoter/quoteAllWellsX2Bean]: Could not determine best Well Swap quote");
    }

    quotes.sort((a, b) => b.buyAmount.sub(a.buyAmount).toNumber());

    return quotes;
  }

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
  approximate0xOut(fromToken: ERC20Token, toToken: ERC20Token, amount: TokenValue, slippage: number): SwapApproximation {
    const fromTokenUsd = this.swapV2.getTokenUsd(fromToken);
    const toTokenUsd = this.swapV2.getTokenUsd(toToken);
    const relativeUsd = fromTokenUsd.div(toTokenUsd);

    const pairTokenAmount = toToken.fromHuman(relativeUsd.mul(amount).toHuman());

    const amountLessFees = 1 - 0.0003; // Assume 0.03 % fee

    return {
      minAmountOut: pairTokenAmount.subSlippage(slippage).mul(amountLessFees),
      maxAmountOut: pairTokenAmount.mul(amountLessFees)
    };
  }

  /**
   * Ensures the token is an ERC20 token. If token is ETH, returns WETH.
   * @throws If token is not an ERC20 | NativeToken.
   */
  private ensureERC20(token: Token): ERC20Token {
    if (!(token instanceof ERC20Token)) {
      if (token.equals(BeanSwapV2Quoter.sdk.tokens.ETH)) {
        return BeanSwapV2Quoter.sdk.tokens.WETH;
      }

      throw new Error(`Invalid token type. Expected either an ERC20 or Native Token, but got ${token}`);
    }

    return token;
  }
}

// /**
//  * TODO: Eventually add this back in
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

// private constructQuoteResult(quotes: BeanSwapV2Quote | BeanSwapV2Quote[]) {
//   const quoteArray = Array.isArray(quotes) ? quotes : [quotes];

//   if (!quoteArray.length) {
//     throw new Error("BeanSwapV2Quoter: No quotes provided");
//   }

//   const lastQuote = quoteArray[quoteArray.length - 1];
//   const firstQuote = quoteArray[0];

//   const result: BeanSwapV2QuoterResult = {
//     sellToken: firstQuote.sellToken,
//     sellAmount: firstQuote.sellAmount,
//     buyToken: lastQuote.buyToken,
//     buyAmount: lastQuote.buyAmount,
//     minAmountOut: lastQuote.minBuyAmount,
//     usd: lastQuote.usd,
//     path: quoteArray
//   };

//   return result;
// }
