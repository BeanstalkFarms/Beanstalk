import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ERC20Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { SwapV2WellNode, ZeroXSwapNode } from "./SwapV2Node";
import { Clipboard, AdvancedPipeCallStruct } from "src/lib/depot";
import { BigNumber } from "ethers";
import { BeanSwapV2Quoter } from "./BeanSwapV2Quoter";
import { BeanSwapV2Builder } from "./BeanSwapV2Builder";
import { BeanSwapV2QuoterResult } from "./types";
import { FarmFromMode, FarmToMode } from "../farm";

const MAX_STALE_TIME = 5 * 60 * 1000; // 5 mins

/**
 * BeanSwapV2 facilitates swaps that may involve BEAN.
 *
 *
 * @note
 * Weaknesses of BeanSwapV2:
 * - Breaks if there are any wells w/ that have the same non-bean token.
 *
 */
export class BeanSwapV2 {
  private static sdk: BeanstalkSDK;

  readonly zeroXSwapNode: ZeroXSwapNode;

  /**
   * Mapping of wells to their respective well nodes.
   */
  readonly wellNodes: Map<BasinWell, SwapV2WellNode>;

  /**
   * Mapping of Well to their underlying non-bean token pair.
   */
  readonly well2NonBeanPair: Map<BasinWell, ERC20Token>;

  /**
   * Mapping of non-bean tokens to their respective well.
   */
  readonly nonBeanPair2Well: Map<ERC20Token, BasinWell>;

  /**
   * Mapping of non-bean tokens to their price.
   */
  private nonBeanPair2Price: Map<ERC20Token, TokenValue> = new Map();

  /**
   * Timestamp of the last time the prices of non-bean tokens were updated.
   * Instantaneous prices are fetched from the Beanstalk contract.
   */
  private pricesLastUpdated: number = 0;

  private quoter: BeanSwapV2Quoter;

  private builder: BeanSwapV2Builder;

  constructor(sdk: BeanstalkSDK) {
    BeanSwapV2.sdk = sdk;

    const well2Underlying = new Map<BasinWell, ERC20Token>();
    const underlying2Well = new Map<ERC20Token, BasinWell>();
    const wellNodes = new Map<BasinWell, SwapV2WellNode>();

    for (const well of BeanSwapV2.sdk.pools.getWells()) {
      const node = new SwapV2WellNode(BeanSwapV2.sdk, this, well);
      wellNodes.set(well, node);

      const pairToken = node.getPairToken(BeanSwapV2.sdk.tokens.BEAN);
      well2Underlying.set(well, pairToken);
      underlying2Well.set(pairToken, well);
    }

    this.well2NonBeanPair = well2Underlying;
    this.nonBeanPair2Well = underlying2Well;
    this.wellNodes = wellNodes;

    this.zeroXSwapNode = new ZeroXSwapNode(BeanSwapV2.sdk, this);
    this.quoter = new BeanSwapV2Quoter(BeanSwapV2.sdk, this);
    this.builder = new BeanSwapV2Builder(BeanSwapV2.sdk, this);
  }

  async quote(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    direction: "forward" | "reverse",
    slippage: number
  ) {
    await this.refresh();
    return this.quoter.getQuote(sellToken, buyToken, amount, direction, slippage);
  }

  buildWithQuote(
    quoteResults: BeanSwapV2QuoterResult,
    caller: string,
    recipient: string,
    fromMode: FarmFromMode,
    toMode: FarmToMode
  ) {
    return this.builder.build(quoteResults, caller, recipient, fromMode, toMode);
  }

  /**
   * Refreshes the reserves and prices for all wells if the last refresh was more than 5 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   */
  async refresh(force?: boolean) {
    const diff = Date.now() - this.pricesLastUpdated;
    const refreshNeeded = force || diff > MAX_STALE_TIME;

    if (!refreshNeeded) {
      return;
    }

    await this.refreshReservesAndPrices();
  }

  /**
   * Refreshes the reserves and prices for all wells.
   */
  private async refreshReservesAndPrices() {
    const entries = [...this.well2NonBeanPair.entries()];

    const priceMap = new Map<ERC20Token, TokenValue>();
    const pipeCalls: AdvancedPipeCallStruct[] = [];

    for (const [_, token] of entries) {
      const priceCall = {
        target: BeanSwapV2.sdk.contracts.beanstalk.address,
        callData: BeanSwapV2.sdk.contracts.beanstalk.interface.encodeFunctionData(
          "getTokenUsdPrice",
          [token.address]
        ),
        clipboard: Clipboard.encode([])
      };
      pipeCalls.push(priceCall);
    }

    BeanSwapV2.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] AdvPipeCalls:", pipeCalls);

    const data = await BeanSwapV2.sdk.contracts.beanstalk.callStatic.advancedPipe(pipeCalls, "0");

    for (const [i, [_well, underlyingToken]] of entries.entries()) {
      const priceDecoded: BigNumber =
        BeanSwapV2.sdk.contracts.beanstalk.interface.decodeFunctionResult(
          "getTokenUsdPrice",
          data[i]
        )[0];

      const underlyingPrice = TokenValue.fromBlockchain(priceDecoded, 6);
      priceMap.set(underlyingToken, underlyingPrice);
    }

    BeanSwapV2.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] nonBeanTokenPrices RESULTS:", {
      priceMap
    });

    const timestamp = Date.now();
    this.nonBeanPair2Price = priceMap;
    this.pricesLastUpdated = timestamp;
  }

  getTokenUsd(token: ERC20Token) {
    return this.nonBeanPair2Price.get(token) || TokenValue.fromHuman(0, 6);
  }

  getWellNodeWithToken(token: ERC20Token): SwapV2WellNode {
    const well = this.nonBeanPair2Well.get(token);

    if (!well) {
      throw new Error(
        `[BeanSwapV2/getWellNodeWithToken]: Well not found for token ${token.address}`
      );
    }

    const node = this.wellNodes.get(well);

    if (!node) {
      throw new Error(
        `[BeanSwapV2/getWellNodeWithToken]: Well node not found for token ${token.address}`
      );
    }

    return node;
  }
}
