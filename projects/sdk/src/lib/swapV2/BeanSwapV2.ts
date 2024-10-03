import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ERC20Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { SwapV2WellNode, UnwrapEthNode, WrapEthNode, ZeroXSwapNode } from "./SwapV2Node";
import { Clipboard, AdvancedPipeCallStruct } from "src/lib/depot";
import { BeanSwapV2Quoter } from "./BeanSwapV2Quoter";
import { BeanSwapV2Builder } from "./BeanSwapV2Builder";
import { FarmFromMode, FarmToMode } from "../farm";
import { decodePriceContractResult, decodeTokenPriceResult } from "./utils";

const MAX_STALE_TIME = 5 * 60 * 1000; // 5 mins

export class BeanSwapV2 {
  private static sdk: BeanstalkSDK;

  readonly zeroXSwapNode: ZeroXSwapNode;

  readonly wrapEthNode: WrapEthNode;

  readonly unwrapEthNode: UnwrapEthNode;

  private readonly quoter: BeanSwapV2Quoter;

  private readonly builder: BeanSwapV2Builder;

  /**
   * Mapping of non-bean tokens to their respective well.
   */
  readonly nonBeanPair2Well: Map<ERC20Token, BasinWell>;

  /**
   * Mapping of wells to their respective well nodes.
   */
  private wellNodes: Map<BasinWell, SwapV2WellNode>;

  /**
   * Mapping of non-bean tokens to their price.
   */
  private erc20Prices: Map<ERC20Token, TokenValue> = new Map();

  /**
   * Timestamp of the last time the prices of non-bean tokens were updated.
   * Instantaneous prices are fetched from the Beanstalk contract.
   */
  private pricesLastUpdated: number = 0;

  constructor(sdk: BeanstalkSDK) {
    BeanSwapV2.sdk = sdk;

    const underlying2Well = new Map<ERC20Token, BasinWell>();
    const wellNodes = new Map<BasinWell, SwapV2WellNode>();

    for (const well of BeanSwapV2.sdk.pools.getWells()) {
      const node = new SwapV2WellNode(BeanSwapV2.sdk, this, well);
      const pairToken = node.getPairToken(BeanSwapV2.sdk.tokens.BEAN);

      wellNodes.set(well, node);
      underlying2Well.set(pairToken, well);
    }

    this.nonBeanPair2Well = underlying2Well;
    this.wellNodes = wellNodes;

    this.zeroXSwapNode = new ZeroXSwapNode(BeanSwapV2.sdk, this);
    this.wrapEthNode = new WrapEthNode(BeanSwapV2.sdk, this);
    this.unwrapEthNode = new UnwrapEthNode(BeanSwapV2.sdk, this);

    this.quoter = new BeanSwapV2Quoter(BeanSwapV2.sdk, this);
    this.builder = new BeanSwapV2Builder(BeanSwapV2.sdk, this);
  }

  /**
   * Fetch quote
   */
  async quote(
    sellToken: ERC20Token,
    buyToken: ERC20Token,
    amount: TokenValue,
    caller: string,
    recipient: string,
    slippage: number,
    _fromMode: FarmFromMode,
    _toMode: FarmToMode
  ) {
    await this.refresh();

    const fromMode = _fromMode;
    const toMode = _toMode;

    const quotes = await this.quoter.getQuote(sellToken, buyToken, amount, slippage);
    return this.builder.build(quotes, caller, recipient, fromMode, toMode);
  }

  /**
   * Refreshes the reserves and prices for all wells if the last refresh was more than 5 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   */
  async refresh(force?: boolean) {
    const diff = Date.now() - this.pricesLastUpdated;
    const refreshNeeded = force || diff > MAX_STALE_TIME;

    if (refreshNeeded) {
      await this.refreshReservesAndPrices();
    }
  }

  /**
   * Refreshes the reserves and prices for all wells.
   */
  private async refreshReservesAndPrices() {
    const entries = [...this.nonBeanPair2Well.entries()];

    const priceMap = new Map<ERC20Token, TokenValue>();
    const wellNodes = new Map<BasinWell, SwapV2WellNode>();
    const pipeCalls: AdvancedPipeCallStruct[] = [];

    pipeCalls.push({
      target: BeanSwapV2.sdk.contracts.beanstalkPrice.address,
      callData: BeanSwapV2.sdk.contracts.beanstalkPrice.interface.encodeFunctionData("price"),
      clipboard: Clipboard.encode([])
    });

    for (const [pairToken] of entries) {
      // Beanstalk Price AdvPipeStruct
      pipeCalls.push({
        target: BeanSwapV2.sdk.contracts.beanstalk.address,
        callData: BeanSwapV2.sdk.contracts.beanstalk.interface.encodeFunctionData(
          "getTokenUsdPrice",
          [pairToken.address]
        ),
        clipboard: Clipboard.encode([])
      });
    }

    BeanSwapV2.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] AdvPipeCalls:", pipeCalls);

    const [beanstalkPriceData, ...tokenPriceResults] = await BeanSwapV2.sdk.contracts.beanstalk.callStatic.advancedPipe(
      pipeCalls, 
      "0"
    );
    BeanSwapV2.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] AdvPipeResult:", {
      beanstalkPriceData,
      tokenPriceResults
    });
    
    const priceResult = decodePriceContractResult(BeanSwapV2.sdk, beanstalkPriceData);
    priceMap.set(BeanSwapV2.sdk.tokens.BEAN, priceResult.beanPrice);

    for (const [i, [pairToken]] of entries.entries()) {
      priceMap.set(pairToken, decodeTokenPriceResult(BeanSwapV2.sdk, tokenPriceResults[i]));
    }
    BeanSwapV2.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] nonBeanTokenPrices RESULTS:", {
      priceMap, 
      priceResult
    });


    for (const [well, poolPriceData] of priceResult.poolData) {
      const node = this.wellNodes.get(well);
      // If reserves are 0, remove Well as an option for swaps
      if (poolPriceData.reserves.every((r) => r.gt(0))) {
        wellNodes.set(well, node ?? new SwapV2WellNode(BeanSwapV2.sdk, this, well));
      }
    }
    
    this.erc20Prices = priceMap;
    this.pricesLastUpdated = Date.now()
    this.wellNodes = wellNodes;
  }

  getWellNodes() {
    return this.wellNodes;
  }

  getTokenUsd(token: ERC20Token) {
    return this.erc20Prices.get(token) || TokenValue.fromHuman(0, 6);
  }

  getWellNodeWithToken(token: ERC20Token): SwapV2WellNode | undefined {
    const well = this.nonBeanPair2Well.get(token);

    return well && this.wellNodes.get(well);
  }
}
