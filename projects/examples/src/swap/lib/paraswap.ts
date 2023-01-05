import { Token, TokenValue } from "@beanstalk/sdk";
import { BigNumber } from "ethers";

const API_URL = "https://apiv5.paraswap.io";

export type PriceQueryParams = {
  srcToken: string;
  destToken: string;
  srcDecimals: string;
  destDecimals: string;
  amount: string;
  side: "SELL" | "BUY";
  network: string;
  partner: string;
};

export type PriceRoute = {
  blockNumber: number;
  network: number;
  srcToken: string;
  srcDecimals: number;
  srcAmount: string;
  destToken: string;
  destDecimals: number;
  destAmount: string;
  bestRoute: any[];
  gasCostUSD: string;
  gasCost: string;
  side: "SELL" | "BUY";
  tokenTransferProxy: string;
  contractAddress: string;
  contractMethod: string;
  partnerFee: number;
  srcUSD: string;
  destUSD: string;
  partner: string;
  maxImpactReached: boolean;
  hmac: string;
};

export type TransactionResult = {
  from: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  gas?: string;
};

export async function paraSwapQuote(tokenIn: Token, tokenOut: Token, amount: BigNumber): Promise<PriceRoute> {
  const queryParams: PriceQueryParams = {
    srcToken: tokenIn.symbol === "ETH" ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : tokenIn.address,
    destToken: tokenOut.symbol === "ETH" ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : tokenOut.address,
    srcDecimals: tokenIn.decimals.toString(),
    destDecimals: tokenOut.decimals.toString(),
    amount: amount.toString(),
    side: "SELL",
    network: "1",
    partner: "beanstalk"
  };

  const searchString = new URLSearchParams(queryParams);
  const pricesURL = `${API_URL}/prices/?${searchString}`;

  const res = await fetch(pricesURL);
  if (res.ok) {
    const data = await res.json();
    return data.priceRoute as PriceRoute;
  } else {
    throw new Error(`paraSwapQuote(): ${res.status}: ${res.statusText}`);
  }
}

export async function paraSwapTransaction(account: string, priceRoute: PriceRoute, minAmount: TokenValue): Promise<TransactionResult> {
  const txURL = `${API_URL}/transactions/1?ignoreChecks=true`;

  const txConfig = {
    priceRoute,
    srcToken: priceRoute.srcToken,
    srcDecimals: priceRoute.srcDecimals,
    destToken: priceRoute.destToken,
    destDecimals: priceRoute.destDecimals,
    srcAmount: priceRoute.srcAmount,
    destAmount: minAmount.toBlockchain(),
    partner: "yourid",
    userAddress: account //Address of the caller of the transaction (msg.sender)
  };

  const res = await fetch(txURL, {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(txConfig)
  });

  if (res.ok) {
    const data = await res.json();
    return data as TransactionResult;
  } else {
    throw new Error(`paraSwapTransaction(): ${res.status}: ${res.statusText}`);
  }
}
