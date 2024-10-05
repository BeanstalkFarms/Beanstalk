import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token, Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { BeanSwapPriceCache as PriceCache } from "./BeanSwapPriceCache";
import { BigNumber } from "ethers";
import { WellSwapNode, ZeroXSwapNode, WrapEthSwapNode, SwapNode, UnwrapEthSwapNode } from "./nodes";

type RouteDecision = {
  directRoute: WellSwapNode | undefined;
  bestRoute: WellSwapNode;
  routes: WellSwapNode[];
};

interface SwapApproximation {
  minAmountOut: TokenValue;
  maxAmountOut: TokenValue;
}

// prettier-ignore
class WellsRouter {
  static sdk: BeanstalkSDK;
  private quoter: Quoter;

  constructor(sdk: BeanstalkSDK, quoter: Quoter) {
    WellsRouter.sdk = sdk;
    this.quoter = quoter;
  }

  /**
   * Finds the best well routes for a given sellToken and buyToken (ONLY WELLS)
   * @param sellToken 
   * @param buyToken 
   * @param amount 
   * @param slippage 
   * 
   * routes: all routes.
   * 
   * directRoute: Quickest route - Only 1 swap hop, but does not necessarily result in the most buyToken out.
   * 
   * bestRoute: the route that results in the most buyToken out.
   * 
   * How the best route is determined:
   * If we are selling BEAN for X:
   * 1. We perform a well.getSwapOut for all swappable wells in one advancedPipe call to fetch the amount out for each pair token.
   * 2. We sort the routes by the USD value of the amount out from the previous step in descending order.
   * 
   * If we are buying BEAN with X: 
   * 1. For Each swappable well:
   *    - Approximate a swap output between X & each pairToken via Quoter.approximate0xOut().
   *    - We fetch well.getSwapOut for each well in one advancedPipe call using the approximations as the sellAmount.
   * 2. Sort the routes by the amount of BEAN received in descending order.
   * 
   * In the case where directRoute not defined or the best route !== directRoute, combine the best route w/ a non-well swap.
   * 
   * For example, given: sellToken=BEAN, buyToken=WETH
   * - directRoute: BEAN -> WETH
   * - bestRoute: BEAN -> wstETH
   * - perform: BEAN -> wstETH -> WETH
   * 
   * And vice versa. Given sellToken=WETH, buyToken=BEAN
   * - directRoute: WETH -> BEAN
   * - bestRoute: wstETH -> BEAN
   * - perform: WETH -> wstETH -> BEAN
   * 
   * The amounts for the routes that are not direct routes are approximations & make the assumption that the pool will give you a fair price. 
   * Thus, it is important to re-compare the actual amounts out against the direct route after fetching from the swap API.
   */
  async findWellRoutes(sellToken: Token, buyToken: Token, amount: TokenValue, slippage: number): Promise<RouteDecision> {
    const data = this.constructWellGetSwapOutPipeCalls(sellToken, amount, slippage);    
    const results = await this.fetchWellGetSwapOutPipeCalls(data.pipeCalls);

    const sellingBEAN = this.isTokenBEAN(sellToken);

    let directRoute: WellSwapNode | undefined;
    
    const routes = sellingBEAN 
      ? this.decodeDirectWellPipeCalls(this.quoter.wells, results, sellToken, amount, slippage)
      : this.decodeIndirectWellPipeCalls(this.quoter.wells, results, buyToken, data.swapApproximations, slippage);

    if (!routes.length) {
      throw new Error("Unable to find well routes");
    }

    if (sellingBEAN) {
      // sort by USD value out in non-increasing order
      routes.sort((a, b) => {
        const aUsd = this.quoter.priceCache.getTokenUsd(a.buyToken);
        const bUsd = this.quoter.priceCache.getTokenUsd(b.buyToken);
        return bUsd.sub(aUsd).toNumber();
      });
      directRoute = routes.find((r) => r.buyToken.equals(buyToken));
    } else {
      // Sort by the most amount of BEAN out in non-increasing order
      routes.sort((a, b) => b.buyAmount.sub(a.buyAmount).toNumber());
      directRoute = routes.find((r) => r.sellToken.equals(sellToken));
    }

    const result = { routes, directRoute, bestRoute: routes[0] }
    WellsRouter.sdk.debug("[WellsRouter/findWellRoutes] Found routes: ", result);

    return result;
  }

  /**
   * Constructs the AdvancedPipeCallStructs for well.getSwapOut
   * @returns pipeCalls: The AdvancedPipeCallStructs
   * @returns swapApproximations: The SwapApproximations for indirect routes
   */
  private constructWellGetSwapOutPipeCalls(
    sellToken: Token,
    sellAmount: TokenValue,
    slippage: number
  ) {
    const pipeCalls: AdvancedPipeCallStruct[] = [];
    const swapApproximations = new Map<Token, SwapApproximation>();

    for (const well of this.quoter.wells) {
      if (this.isTokenBEAN(sellToken)) {
        // construct well.getSwapOut BEAN -> pairToken
        pipeCalls.push(this.getSwapOutAdvancedPipeStruct(well, sellToken, sellAmount));
      } else {
        // construct well.getSwapOut pairToken -> BEAN
        const intermediateToken = well.getPairToken(WellsRouter.sdk.tokens.BEAN);
        const approximation = this.quoter.approximate0xOut(sellToken, intermediateToken, sellAmount, slippage);
        swapApproximations.set(intermediateToken, approximation);
        pipeCalls.push(
          this.getSwapOutAdvancedPipeStruct(well, intermediateToken, approximation.minAmountOut)
        );
      }
    }

    return { pipeCalls, swapApproximations };
  }

  /**
   * 
   */
  private async fetchWellGetSwapOutPipeCalls(calls: AdvancedPipeCallStruct[]) {
    return await WellsRouter.sdk.contracts.beanstalk.callStatic.advancedPipe(calls, "0");
  }

  /**
   * Decodes the result of well.getSwapOut for direct routes
   */
  private decodeDirectWellPipeCalls(
    wells: BasinWell[],
    result: string[],
    sellToken: Token,
    sellAmount: TokenValue,
    slippage: number
  ) {
    return wells.map((well, i) => 
      this.processDecodedWellGetSwapOut(well, sellToken, sellAmount, result[i], slippage)
    );
  }

  /**
   * Decodes the result of well.getSwapOut for indirect routes
   */
  private decodeIndirectWellPipeCalls(
    wells: BasinWell[],
    result: string[],
    buyToken: Token,
    sellAmounts: Map<Token, SwapApproximation>,
    slippage: number
  ) {
    const steps: WellSwapNode[] = [];

    for (const [i, well] of wells.entries()) {
      const intermediateToken = well.getPairToken(buyToken);
      const approximation = sellAmounts.get(intermediateToken);
      if (!approximation) continue;

      steps.push(
        this.processDecodedWellGetSwapOut(well, intermediateToken, approximation.minAmountOut, result[i], slippage)
      );
    }

    return steps;
  }

  /**
   * Processes the decoded result of well.getSwapOut into a WellSwapStep
   */
  private processDecodedWellGetSwapOut(
    well: BasinWell,
    sellToken: Token,
    sellAmount: TokenValue,
    result: string,
    slippage: number
  ) {
    const buyToken = well.getPairToken(sellToken);
    const buyAmount = buyToken.fromBlockchain(this.decodeGetSwapOut(well, result));

    return new WellSwapNode(WellsRouter.sdk, well).setFields({
      sellToken,
      buyToken,
      sellAmount,
      buyAmount,
      minBuyAmount: buyAmount.subSlippage(slippage),
      slippage,
    });
  }

  /**
   * Constructs an AdvancedPipeCallStruct for well.getSwapOut
   * @param sellToken the token to sell
   * @param amount the amount of sellToken to sell
   */
  private getSwapOutAdvancedPipeStruct(
    well: BasinWell,
    sellToken: Token,
    amount: TokenValue
  ): AdvancedPipeCallStruct {
    const iWell = well.getContract().interface;

    const tokenSell = sellToken.address;
    const tokenBuy = well.getPairToken(sellToken).address;
    const sellAmount = amount.toBlockchain();

    return {
      target: well.address,
      callData: iWell.encodeFunctionData("getSwapOut", [tokenSell, tokenBuy, sellAmount]),
      clipboard: Clipboard.encode([])
    };
  }

  /**
   * Decodes the result of well.getSwapOut
   */
  private decodeGetSwapOut(well: BasinWell, result: string) {
    try {
      const decoded = well.getContract().interface.decodeFunctionResult("getSwapOut", result);
      return BigNumber.from(Array.isArray(decoded) ? decoded[0] : decoded);
    } catch (e) {
      console.error(`Error decoding getSwapOut for ${well.name}`, e);
      throw e;
    }
  }

  private isTokenBEAN(token: Token) {
    return token.equals(WellsRouter.sdk.tokens.BEAN);
  }
}

// prettier-ignore
class Quoter {
  private static sdk: BeanstalkSDK;

  #wellsRouter: WellsRouter;

  #wells: BasinWell[];

  priceCache: PriceCache;

  constructor(sdk: BeanstalkSDK) {
    Quoter.sdk = sdk;

    this.priceCache = new PriceCache(sdk);
    this.#wells = [...Quoter.sdk.pools.getWells()];
    this.#wellsRouter = new WellsRouter(Quoter.sdk, this);
  }

  get wells() {
    return this.#wells;
  }

  
  async refresh(force?: boolean) {
    const didRefresh = await this.priceCache.refresh(force);
    if (!didRefresh) return;

    this.#wells = Quoter.sdk.pools.getWells().filter((well) => {
      return this.priceCache.hasReservesAndPrices(well);
    });
  }

  async getQuote(sellToken: Token, buyToken: Token, amount: TokenValue, slippage: number): Promise<SwapNode[]> {
    const WETH = Quoter.sdk.tokens.WETH;
    const ETH = Quoter.sdk.tokens.ETH;
    const nodes: SwapNode[] = [];

    const unwrapNode = new UnwrapEthSwapNode(Quoter.sdk);
    const wrapNode = new WrapEthSwapNode(Quoter.sdk);

    const wrappingETH = sellToken.equals(ETH);
    const unwrappingETH = buyToken.equals(ETH);

    const swapPath = await this.handleERC20OnlyQuote(sellToken, buyToken, amount, slippage);

    if (sellToken.equals(WETH) && unwrappingETH) {
      unwrapNode.setFields({ sellAmount: amount });
      return [unwrapNode];
    }

    if (wrappingETH) {
      wrapNode.setFields({ sellAmount: amount });
      nodes.push(wrapNode);

      if (buyToken.equals(WETH)) {
        return nodes;
      }
    }

    nodes.push(...swapPath);

    if (unwrappingETH) {
      const lastSwapNode = nodes[nodes.length - 1];
      unwrapNode.setFields({ sellAmount: lastSwapNode.buyAmount });
      nodes.push(unwrapNode);
    }

    return nodes;
  }

  private async handleERC20OnlyQuote(
    sellToken: Token,
    buyToken: Token,
    amount: TokenValue,
    slippage: number
  ) {
    sellToken = this.ensureERC20(sellToken);
    buyToken = this.ensureERC20(buyToken);
    const isBEANSwap = this.isTokenBEAN(buyToken) || this.isTokenBEAN(sellToken);

    if (sellToken.equals(buyToken)) return [] as SwapNode[];
    const quoteFunction = isBEANSwap ? this.quoteBeanSwap : this.quoteNonBeanSwap;

    return quoteFunction(sellToken, buyToken, amount, slippage);
  }

  // TODO: Eventually provide Well1 => BEAN => Well2
  private async quoteNonBeanSwap(
    sellToken: Token,
    buyToken: Token,
    amount: TokenValue,
    slippage: number
  ): Promise<SwapNode[]> {
    if (sellToken.equals(buyToken)) {
      throw new Error("Invalid swap path. SellToken and BuyToken cannot be the same");
    }
    const zeroX = new ZeroXSwapNode(Quoter.sdk);
    await zeroX.quoteForward(sellToken, buyToken, amount, slippage);
    return [zeroX];
  }

  // prettier-ignore
  private async quoteBeanSwap(sellToken: Token, buyToken: Token, amount: TokenValue, slippage: number): Promise<SwapNode[]> {
    const sellingBEAN = this.isTokenBEAN(sellToken);
    const buyingBEAN = this.isTokenBEAN(buyToken);

    if (sellToken.equals(buyToken)) {
      throw new Error("Invalid swap path. Expected SellToken and BuyToken to be different.");
    }
    if (!sellingBEAN && !buyingBEAN) {
      throw new Error(
        "Error determining swap path. Expected either sellToken or buyToken to be BEAN."
      );
    }

    const routes = await this.#wellsRouter.findWellRoutes(sellToken, buyToken, amount, slippage);

    if (routes.directRoute?.equals(routes.bestRoute)) {
      Quoter.sdk.debug("[BeanSwapQuoter/quoteBeanSwap] Using direct route: ", routes.directRoute);
      return [routes.directRoute];
    }
    
    const nodes = sellingBEAN 
      ? this.finalizeSellBeansRoute(routes, buyToken, slippage)
      : this.finalizeBuyBeansRoute(routes, sellToken, slippage);

    Quoter.sdk.debug("[BeanSwapQuoter/processSellBeansSwap] Selected route: ", nodes);
    return nodes;
  }

  private async finalizeSellBeansRoute(routes: RouteDecision, buyToken: Token, slippage: number) {
    const { directRoute, bestRoute } = routes;
    const zeroX = new ZeroXSwapNode(Quoter.sdk);

    await zeroX.quoteForward(Quoter.sdk.tokens.BEAN, buyToken, bestRoute.minBuyAmount, slippage);
    if (directRoute?.minBuyAmount.gt(zeroX.minBuyAmount)) {
      return [directRoute];
    }
    return [bestRoute, zeroX];
  }

  private async finalizeBuyBeansRoute(routes: RouteDecision, sellToken: Token, slippage: number) {
    const { directRoute, bestRoute } = routes;
    const BEAN = Quoter.sdk.tokens.BEAN;
    const zeroX = new ZeroXSwapNode(Quoter.sdk);

    await zeroX.quoteForward(sellToken, bestRoute.sellToken, bestRoute.sellAmount, slippage);
    await bestRoute.quoteForward(zeroX.buyToken, BEAN, zeroX.minBuyAmount, slippage);

    if (directRoute?.minBuyAmount.gt(bestRoute.minBuyAmount)) {
      return [directRoute];
    } else {
      return [zeroX, bestRoute];
    }
  }

  /**
   * Approximates the sell amount for a token pair in a swap operation via 0x.
   * @param sellToken The token being sold
   * @param sellAmount The amount of sellToken to be sold
   * @param buyToken The token to be bought
   * @param slippage The maximum acceptable slippage for the swap
   * @returns minAmountOut: The min amount of buyToken to be received. AmountOut - slippage - fees
   * @returns maxAmountOut: The max amount of buyToken to be received. AmountOut - fees
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
   * Note: This is an approximation and does not account for accurate fees, or
   * the actual liquidity in the pool, which may affect the real swap outcome.
   */
  approximate0xOut(
    fromToken: Token,
    toToken: Token,
    amount: TokenValue,
    slippage: number
  ): SwapApproximation {
    const fromTokenUsd = this.priceCache.getTokenUsd(fromToken);
    const toTokenUsd = this.priceCache.getTokenUsd(toToken);
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
      if (token.equals(Quoter.sdk.tokens.ETH)) {
        return Quoter.sdk.tokens.WETH;
      }

      throw new Error(
        `Invalid token type. Expected either an ERC20 or Native Token, but got ${token}`
      );
    }

    return token;
  }

  private isTokenBEAN(token: Token) {
    return Quoter.sdk.tokens.BEAN.equals(token);
  }
}

export { Quoter as BeanSwapQuoter };

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

// private async quoteSellBean(
//   sellToken: Token,
//   buyToken: Token,
//   amount: TokenValue,
//   slippage: number
// ): Promise<SwapNode[]> {
//   if (!sellToken.equals(Quoter.sdk.tokens.BEAN)) {
//     throw new Error("Expected sellToken to be a BEAN token");
//   }
//   if (buyToken.equals(Quoter.sdk.tokens.BEAN)) {
//     throw new Error("Expected buyToken to be a non-BEAN token");
//   }

//   const nodes: SwapNode[] = [];
//   const { directRoute, bestRoute } = await this.#wellsRouter.findWellRoutes(
//     sellToken,
//     buyToken,
//     amount,
//     slippage
//   );

//   if (directRoute?.equals(bestRoute)) {
//     nodes.push(directRoute);
//   } else {
//     const zeroXNode = new ZeroXSwapNode(Quoter.sdk);
//     await zeroXNode.quoteForward(bestRoute.buyToken, buyToken, bestRoute.minBuyAmount, slippage);

//     if (directRoute?.minBuyAmount.gt(zeroXNode.minBuyAmount)) {
//       nodes.push(directRoute);
//     } else {
//       nodes.push(bestRoute, zeroXNode);
//     }
//   }
//   Quoter.sdk.debug("[BeanSwapQuoter/quoteSellBean] Selected route: ", nodes);
//   return nodes;
// }

// /**
//  * quote NON-bean token to BEAN
//  * @param sellToken
//  * @param buyToken
//  * @param amount
//  * @param slippage
//  * @returns
//  */
// private async quoteBuyBean(
//   sellToken: Token,
//   buyToken: Token,
//   amount: TokenValue,
//   slippage: number
// ): Promise<SwapNode[]> {
//   if (!buyToken.equals(Quoter.sdk.tokens.BEAN)) {
//     throw new Error("Expected buyToken to be a BEAN token");
//   }

//   if (sellToken.equals(buyToken)) {
//     throw new Error(
//       "Error determing best well to buy BEAN. Expected sellToken to be a non-BEAN token"
//     );
//   }

//   const nodes: SwapNode[] = [];
//   const { directRoute, bestRoute } = await this.#wellsRouter.findWellRoutes(
//     sellToken,
//     buyToken,
//     amount,
//     slippage
//   );

//   if (directRoute?.equals(bestRoute)) {
//     nodes.push(directRoute);
//   } else {
//     const zeroXNode = new ZeroXSwapNode(Quoter.sdk);
//     await zeroXNode.quoteForward(bestRoute.buyToken, buyToken, bestRoute.minBuyAmount, slippage);
//     // re-fetch w/ the actual amountOut from 0x to ensure quote accuracy
//     await bestRoute.quoteForward(zeroXNode.buyToken, buyToken, zeroXNode.minBuyAmount, slippage);

//     if (directRoute?.minBuyAmount.gt(bestRoute.minBuyAmount)) {
//       nodes.push(directRoute);
//     } else {
//       nodes.push(zeroXNode, bestRoute);
//     }
//   }
//   Quoter.sdk.debug("[BeanSwapQuoter/quoteBuyBean] Selected route: ", nodes);
//   return nodes;
// }
