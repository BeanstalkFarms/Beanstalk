import { ERC20Token } from "src/classes/Token";
import { AdvancedPipeCallStruct } from "src/lib/depot";
import { TokenValue } from "@beanstalk/sdk-core";
import { SwapV2Node } from "./SwapV2Node";

export type SwapV2Direction = "forward" | "reverse";

export type SwapV2SourceType = "WELL" | "0x" | "WRAP_UNWRAP_ETH";

export interface BeanSwapV2Quote {
  sellToken: ERC20Token;
  sellAmount: TokenValue;
  buyToken: ERC20Token;
  buyAmount: TokenValue;
  maxSellAmount: TokenValue; // for reverse swaps, the maximum amount that can be sold
  minBuyAmount: TokenValue; // for forward swaps, the minimum amount that must be bought
  usd: TokenValue;
  sourceType: SwapV2SourceType;
  sourceName: string;
  allowanceTarget: string;
  isReverse: boolean;
  data?: string | AdvancedPipeCallStruct | ((...params: any[]) => AdvancedPipeCallStruct);
  node: SwapV2Node;
  tag: `buy-${string}`;
}

export interface BeanSwapV2QuoterResult {
  sellToken: ERC20Token;
  buyToken: ERC20Token;
  sellAmount: TokenValue;
  buyAmount: TokenValue;
  minAmountOut: TokenValue;
  usd: TokenValue;
  path: BeanSwapV2Quote[];
}

export type BeanSwapV2QuoterOptions = {
  /**
   * If true, only wells will be used for the quote.
   */
  wellsOnly?: boolean;
};

export type MinimumViableClipboardSettings = {
  copySlot: number;
};
