import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token, Token } from "src/classes/Token";
import { NativeToken, TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { BeanSwapPriceCache as PriceCache } from "./BeanSwapPriceCache";
import { BigNumber } from "ethers";
import {
  WellSwapNode,
  ZeroXSwapNode,
  WrapEthSwapNode,
  SwapNode,
  UnwrapEthSwapNode
} from "./nodes";
import { isERC20Token } from "src/utils/token";

type WellsRouterSummary = {
  directRoute: WellSwapNode | undefined;
  bestRoute: WellSwapNode;
  routes: WellSwapNode[];
};

interface SwapApproximation {
  minBuyAmount: TokenValue;
  maxBuyAmount: TokenValue;
}

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
   * @returns undefined if no routes found
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
  async findWellRoutes(sellToken: ERC20Token, buyToken: ERC20Token, amount: TokenValue, slippage: number): Promise<WellsRouterSummary | undefined> {
    if (!isERC20Token(sellToken) || !isERC20Token(buyToken)) {
      throw new Error("Invalid token types. Cannot quote well routes for non-erc20 tokens");
    }
    if (!this.isTokenBEAN(sellToken) && !this.isTokenBEAN(buyToken)) {
      throw new Error("WellsQuoter currently only supports BEAN swaps");
    }

    const sellingBEAN = this.isTokenBEAN(sellToken);

    const data = this.constructWellGetSwapOutPipeCalls(sellToken, amount, slippage);
    const results = await this.fetchWellGetSwapOutPipeCalls(data.pipeCalls);
    
    const routes = sellingBEAN 
      ? this.decodeDirectWellPipeCalls(this.quoter.wellsWithReserves, results, sellToken, amount, slippage)
      : this.decodeIndirectWellPipeCalls(this.quoter.wellsWithReserves, results, buyToken, data.swapApproximations, slippage);

    if (!routes.length) {
      return undefined;
    }

    const summary = this.makeSummary(routes, sellToken, buyToken);

    return summary;
  }

  /**
   * Constructs a summary of the routes found by the WellsRouter
   */
  private makeSummary(routes: WellSwapNode[], sellToken: ERC20Token, buyToken: ERC20Token): WellsRouterSummary {
    const sellingBEAN = this.isTokenBEAN(sellToken);

    const sortByBuyAmount = (a: WellSwapNode, b: WellSwapNode) => {
      return b.buyAmount.sub(a.buyAmount).toNumber();
    }
    const sortByUsdOut = (a: WellSwapNode, b: WellSwapNode) => {
      const aUsd = this.quoter.priceCache.getTokenUsd(a.buyToken).mul(a.buyAmount);
      const bUsd = this.quoter.priceCache.getTokenUsd(b.buyToken).mul(b.buyAmount);
      return bUsd.sub(aUsd).toNumber();
    }

    routes.sort(sellingBEAN ? sortByUsdOut : sortByBuyAmount);

    const compareKey = sellingBEAN ? "buyToken" : "sellToken";
    const compareToken = sellingBEAN ? buyToken : sellToken;

    const bestRoute = routes[0];
    const directRoute = routes.find((r) => r[compareKey].equals(compareToken));

    const summary: WellsRouterSummary = {
      bestRoute,
      directRoute,
      routes: routes
    }

    WellsRouter.sdk.debug("[WellsRouter/makeSummary] Summary: ", summary);
    return summary;
  }

  /**
   * Constructs the AdvancedPipeCallStructs for well.getSwapOut
   * @returns pipeCalls: The AdvancedPipeCallStructs
   * @returns swapApproximations: The SwapApproximations for indirect routes
   */
  private constructWellGetSwapOutPipeCalls(sellToken: ERC20Token, sellAmount: TokenValue, slippage: number) {
    const pipeCalls: AdvancedPipeCallStruct[] = [];
    const swapApproximations = new Map<Token, SwapApproximation>();

    for (const well of this.quoter.wellsWithReserves) {
      // construct well.getSwapOut BEAN -> pairToken
      if (this.isTokenBEAN(sellToken)) {
        pipeCalls.push(this.getSwapOutAdvancedPipeStruct(well, sellToken, sellAmount));
      } else {
        // construct well.getSwapOut pairToken -> BEAN
        const beanPair = well.getPairToken(WellsRouter.sdk.tokens.BEAN);

        const approximation = !sellToken.equals(beanPair) 
          ? this.quoter.approximate0xOut(sellToken, beanPair, sellAmount, slippage)
          : { 
              maxBuyAmount: sellAmount, 
              minBuyAmount: sellAmount 
            };

        swapApproximations.set(beanPair, approximation);
        pipeCalls.push(
          this.getSwapOutAdvancedPipeStruct(well, beanPair, approximation.minBuyAmount)
        );
      }
    }

    WellsRouter.sdk.debug("[WellsRouter/constructWellGetSwapOutPipeCalls] PipelineCalls & Swap Approximations: ", {
      pipeCalls,
      swapApproximations
    });

    return { pipeCalls, swapApproximations };
  }

  /**
   * Constructs an AdvancedPipeCallStruct for well.getSwapOut
   * @param sellToken the token to sell
   * @param amount the amount of sellToken to sell
   */
  private getSwapOutAdvancedPipeStruct(well: BasinWell, sellToken: ERC20Token, amount: TokenValue): AdvancedPipeCallStruct {
    const iWell = well.getContract().interface;

    return {
      target: well.address,
      callData: iWell.encodeFunctionData("getSwapOut", [
        sellToken.address, 
        well.getPairToken(sellToken).address, 
        amount.toBlockchain()
      ]),
      clipboard: Clipboard.encode([])
    };
  }

  /**
   * 
   */
  private async fetchWellGetSwapOutPipeCalls(calls: AdvancedPipeCallStruct[]) {
    return await WellsRouter.sdk.contracts.beanstalk.callStatic.advancedPipe(calls, "0");
  }

  /**
   * Decodes the result of well.getSwapOut for sell BEAN routes.
   */
  private decodeDirectWellPipeCalls(wells: BasinWell[], result: string[], sellToken: ERC20Token, sellAmount: TokenValue, slippage: number) {
    return wells.map((well, i) => 
      this.processDecodedWellGetSwapOut(well, sellToken, sellAmount, result[i], slippage)
    );
  }

  /**
   * Decodes the result of well.getSwapOut for buy BEAN routes.
   */
  private decodeIndirectWellPipeCalls(wells: BasinWell[], result: string[], buyToken: ERC20Token, sellAmounts: Map<Token, SwapApproximation>, slippage: number) {
    const steps: WellSwapNode[] = [];

    for (const [i, well] of wells.entries()) {
      const intermediateToken = well.getPairToken(buyToken);
      const approximation = sellAmounts.get(intermediateToken);
      if (!approximation) continue;

      steps.push(
        this.processDecodedWellGetSwapOut(well, intermediateToken, approximation.minBuyAmount, result[i], slippage)
      );
    }

    return steps;
  }

  /**
   * Processes the decoded result of well.getSwapOut into a WellSwapStep
   */
  private processDecodedWellGetSwapOut(well: BasinWell, sellToken: ERC20Token, sellAmount: TokenValue, result: string, slippage: number) {
    const buyToken = well.getPairToken(sellToken);
    const buyAmount = buyToken.fromBlockchain(this.decodeGetSwapOut(well, result));
    const minBuyAmount = buyAmount.subSlippage(slippage);

    const node = new WellSwapNode(WellsRouter.sdk, well, sellToken, buyToken);
    node.setFields({ sellAmount, buyAmount, minBuyAmount, slippage });
    return node;
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

  /**
   * Wells that have reserves
   */
  #wellsWithReserves: BasinWell[];

  priceCache: PriceCache;

  constructor(sdk: BeanstalkSDK) {
    Quoter.sdk = sdk;

    this.priceCache = new PriceCache(sdk);
    this.#wellsWithReserves = [...Quoter.sdk.pools.getWells()];
    this.#wellsRouter = new WellsRouter(Quoter.sdk, this);
  }

  get wellsWithReserves() {
    return this.#wellsWithReserves;
  }

  async refresh(force?: boolean) {
    const didRefresh = await this.priceCache.refresh(force);
    if (!didRefresh) return;

    this.#wellsWithReserves = Quoter.sdk.pools.getWells().filter((well) => {
      return this.priceCache.hasReservesAndPrices(well);
    });
  }

  async route(sellToken: ERC20Token | NativeToken, buyToken: ERC20Token | NativeToken, amount: TokenValue, slippage: number): Promise<SwapNode[]> {
    const WETH = Quoter.sdk.tokens.WETH;
    const ETH = Quoter.sdk.tokens.ETH;
    const nodes: SwapNode[] = [];
    
    const unwrapEthNode = new UnwrapEthSwapNode(Quoter.sdk);
    const wrapEthNode = new WrapEthSwapNode(Quoter.sdk);

    const sellingWETH = WETH.equals(sellToken);
    const buyingWETH = WETH.equals(buyToken);
    
    const wrappingETH = sellToken.equals(ETH);
    const unwrappingETH = buyToken.equals(ETH);
    
    await this.refresh();

    // ONLY WETH -> ETH
    if (sellingWETH && unwrappingETH) {
      unwrapEthNode.setFields({ sellAmount: amount });
      return [unwrapEthNode];
    }

    // ETH -> X
    if (wrappingETH) {
      wrapEthNode.setFields({ sellAmount: amount });
      nodes.push(wrapEthNode);

      // ONLY ETH -> WETH 
      if (buyingWETH) {
        return nodes;
      }
    }
 
    const swapPath = await this.handleERC20OnlyQuote(sellToken, buyToken as ERC20Token, amount, slippage);
    nodes.push(...swapPath);

    if (unwrappingETH) {
      const lastSwapNode = nodes[nodes.length - 1];
      unwrapEthNode.setFields({ sellAmount: lastSwapNode.buyAmount });
      nodes.push(unwrapEthNode);
    }

    return nodes;
  }

  async handleERC20OnlyQuote(_sellToken: Token, _buyToken: Token, amount: TokenValue, slippage: number) {
    const sellToken = this.ensureERC20(_sellToken);
    const buyToken = this.ensureERC20(_buyToken);

    if (sellToken.equals(buyToken)) return [] as SwapNode[];

    if (this.isTokenBEAN(buyToken) || this.isTokenBEAN(sellToken)) {
      return this.quoteBeanSwap(sellToken, buyToken, amount, slippage);
    }

    return this.quoteNonBeanSwap(sellToken, buyToken, amount, slippage);
  }

  /// ---------- NON-BEAN SWAP ---------- ///

  // TODO: Eventually provide Well1 => BEAN => Well2
  async quoteNonBeanSwap(sellToken: ERC20Token, buyToken: ERC20Token, amount: TokenValue, slippage: number): Promise<SwapNode[]> {
    if (sellToken.equals(buyToken)) {
      throw new Error("Invalid swap path. SellToken and BuyToken cannot be the same");
    }
    const zeroX = new ZeroXSwapNode(Quoter.sdk, sellToken, buyToken);
    await zeroX.quoteForward(amount, slippage);
    return [zeroX];
  }

  /// ---------- BEAN SWAP ---------- ///

  // prettier-ignore
  async quoteBeanSwap(sellToken: ERC20Token, buyToken: ERC20Token, amount: TokenValue, slippage: number): Promise<SwapNode[]> {
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

    const routesSummary = await this.#wellsRouter.findWellRoutes(sellToken, buyToken, amount, slippage);
    if (!routesSummary || !routesSummary.routes.length) {
      return [] as SwapNode[];
    } 
    if (routesSummary.routes.length === 1) {
      Quoter.sdk.debug("[BeanSwapQuoter/finalizeSellBeansRoute] Only 1 route found. Using route: ", routesSummary.bestRoute);
      return routesSummary.routes;
    }

    const nodes = sellingBEAN 
      ? await this.finalizeSellBeansRoute(routesSummary, buyToken, slippage)
      : await this.finalizeBuyBeansRoute(routesSummary, sellToken, amount, slippage);

    Quoter.sdk.debug("[BeanSwapQuoter/processSellBeansSwap] Selected route: ", nodes);
    return nodes;
  }

  /**
   * Assumes route length > 1
   * Determines whether to utilize:
   * - direct route: BEAN -> buyToken
   * - best route: BEAN -> otherToken -> buyToken
   */
  private async finalizeSellBeansRoute(summary: WellsRouterSummary, buyToken: ERC20Token, slippage: number) {
    const { directRoute, bestRoute } = summary;

    if (directRoute && directRoute === bestRoute) {
      Quoter.sdk.debug("[BeanSwapQuoter/finalizeSellBeansRoute] Using direct route: ", directRoute);
      return [directRoute];
    }

    const zeroX = new ZeroXSwapNode(Quoter.sdk, bestRoute.buyToken, buyToken);
    await zeroX.quoteForward(bestRoute.minBuyAmount, slippage);
  
    if (directRoute?.minBuyAmount.gt(zeroX.minBuyAmount)) {
      return [directRoute];
    }
    return [bestRoute, zeroX];
  }

  /**
   * Assumes route length > 1
   * Determines whether to utilize:
   * - direct route: sellToken -> BEAN
   * - best route: sellToken -> otherToken -> BEAN
   */
  private async finalizeBuyBeansRoute(summary: WellsRouterSummary, sellToken: ERC20Token, sellAmount: TokenValue, slippage: number) {
    const { directRoute, bestRoute } = summary;

    if (directRoute && directRoute === bestRoute) {
      Quoter.sdk.debug("[BeanSwapQuoter/finalizeBuyBeansRoute] Using direct route: ", directRoute);
      return [directRoute];
    }

    const zeroX = new ZeroXSwapNode(Quoter.sdk, sellToken, bestRoute.sellToken);
    await zeroX.quoteForward(sellAmount, slippage);
    await bestRoute.quoteForward(zeroX.minBuyAmount, slippage);

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
    fromToken: ERC20Token,
    toToken: ERC20Token,
    amount: TokenValue,
    slippage: number
  ): SwapApproximation {
    const fromTokenUsd = this.priceCache.getTokenUsd(fromToken);
    const toTokenUsd = this.priceCache.getTokenUsd(toToken);
    const relativeUsd = fromTokenUsd.div(toTokenUsd);

    const pairTokenAmount = toToken.fromHuman(relativeUsd.mul(amount).toHuman());

    const amountLessFees = 1 - 0.0003; // Assume 0.03 % fee

    return {
      minBuyAmount: pairTokenAmount.subSlippage(slippage).mul(amountLessFees),
      maxBuyAmount: pairTokenAmount.mul(amountLessFees)
    };
  }

  /**
   * Ensures the token is an ERC20 token. If token is ETH, returns WETH.
   * @throws If token is not an ERC20 | NativeToken.
   */
  private ensureERC20(token: Token): ERC20Token {
    if (token instanceof ERC20Token) {
      return token;
    }
    if (token.equals(Quoter.sdk.tokens.ETH)) {
      return Quoter.sdk.tokens.WETH;
    }
    throw new Error(
      `Invalid token type. Expected either an ERC20 or Native Token, but got ${token}`
    );
  }

  private isTokenBEAN(token: Token) {
    return Quoter.sdk.tokens.BEAN.equals(token);
  }
}

export { Quoter as BeanSwapQuoter };

