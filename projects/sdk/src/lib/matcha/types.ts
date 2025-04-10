export interface ZeroXQuoteV2Params {
  chainId: number;
  buyToken: string;
  sellToken: string;
  sellAmount: string;
  taker?: string;
  txOrigin?: string;
  swapFeeRecipient?: string;
  swapFeeBps?: number;
  tradeSurplusRecipient?: string;
  gasPrice?: string;
  slippageBps?: number;
  excludedSources?: string;
  sellEntireBalance?: boolean;
}

export interface ZeroXQuoteHeaders {
  "0x-api-key": string;
  "0x-version": "v2" | "v1";
}

export type ZeroXSwapFeeType =
  | "zeroExFee" // The fee charged by 0x for the trade.
  | "integratorFee" // The specified fee to charge and deliver to the 'swapFeeRecipient'
  | "gasFee"; // The gas fee to be used in submitting the transaction.

export interface ZeroXSwapFeeDetails {
  amount: string;
  token: string;
  type: string;
}

export interface ZeroXQuoteV2Response {
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  fees: Record<ZeroXSwapFeeType, ZeroXSwapFeeDetails | null>;
  issues: {
    allowance: {
      actual: string;
      spender: string;
    } | null;
    balance: {
      token: string;
      actual: string;
      expected: string;
    } | null;
    simulationIncomplete: boolean;
    invalidSourcesPassed: string[];
    liquidityAvailable: boolean;
  };
  minBuyAmount: string;
  route: {
    fills: {
      from: string;
      to: string;
      source: string;
      proportionBps: string;
    }[];
    tokens: {
      address: string;
      symbol: string;
    }[];
  };
  sellAmount: string;
  sellToken: string;
  tokenMetadata: {
    buyToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };

    sellToken: {
      buyTaxBps: string | null;
      sellTaxBps: string | null;
    };
  };
  totalNetworkFee: string | null;
  transaction: {
    to: string;
    data: string;
    gas: string | null;
    gasPrice: string;
    value: string;
  };
  zid: string;
}
