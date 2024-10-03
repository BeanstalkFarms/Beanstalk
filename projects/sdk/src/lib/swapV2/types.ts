import { ERC20Token, NativeToken } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { SwapV2Node } from "./SwapV2Node";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { AdvancedFarmWorkflow } from "../farm";

export type SwapV2SourceType = "WELL" | "0x" | "WRAP_ETH" | "UNWRAP_ETH";

export interface BeanSwapV2SimpleQuote {
  /**
   * The token being sold in exchange for buyToken (input token)
   */
  sellToken: ERC20Token | NativeToken;
  /**
   * The token being bought
   */
  buyToken: ERC20Token | NativeToken;
  /**
   * The amount of sellToken being sold
   */
  sellAmount: TokenValue;
  /**
   * The amount of buyToken being bought. Usually from a quote.
   */
  buyAmount: TokenValue;
  /**
   * The maximum amount of sellToken that can be sold.
   * For reverse swaps, this is typically amountOut plus slippage
   */
  maxSellAmount: TokenValue;
  /**
   * The minimum amount of buyToken that must be bought.
   * For forward swaps, this is typically amountOut minus slippage
   */
  minBuyAmount: TokenValue;
  /**
   * The value of the quote in USD
   */
  usd: TokenValue;
  /**
   * The name of the source of the quote (well name, "0x", "wrap/unwrap ETH")
   */
  sourceName: string;
}

export interface BeanSwapV2Quote extends BeanSwapV2SimpleQuote {
  /**
   * The source of the quote (well, 0x, wrap/unwrap ETH)
   */
  sourceType: SwapV2SourceType;
  /**
   * The address that the allowance should be set to
   */
  allowanceTarget: string;
  /**
   * The data for the quote.
   */
  data?: string;
  /**
   * The node that the quote is from
   */
  node: SwapV2Node;
  /**
   * The tag for the quote. This is used to identify the quote in the clipboard. Usually buy-${token.symbol}
   */
  tag: `buy-${string}`;
}

export interface BeanSwapV2QuoterResult {
  sellToken: ERC20Token | NativeToken;
  sellAmount: TokenValue;
  maxSellAmount: TokenValue;
  buyToken: ERC20Token | NativeToken;
  buyAmount: TokenValue;
  minBuyAmount: TokenValue;
  usd: TokenValue;
  routes: BeanSwapV2SimpleQuote[];
  advancedFarm: AdvancedFarmWorkflow;
}

export type MinimumViableClipboardSettings = {
  copySlot: number;
};

export interface PricePoolData {
  well: BasinWell;
  address: string;
  price: TokenValue;
  reserves: [TokenValue, TokenValue];
  deltaB: TokenValue;
  liquidity: TokenValue;
  lpUsd: TokenValue;
  lpBdv: TokenValue;
}

export interface SwapApproximation {
  minAmountOut: TokenValue;
  maxAmountOut: TokenValue;
}
