import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ZeroXQuoteV2Params, ZeroXQuoteV2Response } from "./types";
import { ChainResolver } from "@beanstalk/sdk-core";
import { isAddress } from "ethers/lib/utils";

type RequestParams = Omit<RequestInit, "headers" | "method">;

export class ZeroX {
  static sdk: BeanstalkSDK;

  private static endpoint = "https://0x.bean.money/swap/allowance-holder/quote";

  constructor(sdk: BeanstalkSDK) {
    ZeroX.sdk = sdk;
  }

  /**
   * Fetches quotes from the 0x API
   *
   * @param args - a single request or an array of requests
   * @param requestInit - optional request init params
   * @returns
   */
  async quote<T extends ZeroXQuoteV2Params = ZeroXQuoteV2Params>(
    args: T | T[],
    requestInit?: RequestParams
  ): Promise<ZeroXQuoteV2Response[]> {
    if (!ZeroX.endpoint) {
      throw new Error("ERROR: Router endpoint is not set");
    }

    const fetchArgs = Array.isArray(args) ? args : [args];

    const requests = fetchArgs.map((params) => {
      if (!params.buyToken && !params.sellToken) {
        throw new Error("buyToken and sellToken and required");
      }

      if (!params.sellAmount) {
        throw new Error("sellAmount is required");
      }

      const urlParams = new URLSearchParams(
        this.generateQuoteParams(params) as unknown as Record<string, string>
      );

      return () => this.send0xRequest(urlParams, requestInit);
    });

    return Promise.all(requests.map((r) => r()));
  }
  private async send0xRequest(
    urlParams: URLSearchParams,
    requestInit?: Omit<RequestInit, "headers" | "method">
  ) {
    const options = {
      ...requestInit,
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        Accept: "application/json"
      })
    };

    const url = `${ZeroX.endpoint}/?${urlParams.toString()}`;

    return fetch(url, options).then((r) => r.json()) as Promise<ZeroXQuoteV2Response>;
  }

  /**
   * Generate the params for the 0x API
   * @throws if required params are missing
   *
   * @returns the params for the 0x API
   */
  private generateQuoteParams<T extends ZeroXQuoteV2Params = ZeroXQuoteV2Params>(
    params: T
  ): ZeroXQuoteV2Params {
    if (!ZeroX.isValidQuoteParams(params)) {
      throw new Error("ERROR: Invalid quote params");
    }

    const quoteParams: ZeroXQuoteV2Params = {
      chainId: ChainResolver.resolveToMainnetChainId(params.chainId),
      buyToken: params.buyToken,
      sellToken: params.sellToken,
      sellAmount: params.sellAmount,
      taker: params.taker,
      txOrigin: params.txOrigin ?? undefined,
      swapFeeRecipient: params.swapFeeRecipient ?? undefined,
      swapFeeBps: params.swapFeeBps ?? undefined,
      tradeSurplusRecipient: params.tradeSurplusRecipient ?? undefined,
      gasPrice: params.gasPrice,
      slippageBps: params.slippageBps ?? 10, // default 0.1% slippage
      excludedSources: params.excludedSources,
      sellEntireBalance: params.sellEntireBalance ?? false
    };

    Object.keys(quoteParams).forEach((_key) => {
      const key = _key as keyof ZeroXQuoteV2Params;
      if (!quoteParams[key]) {
        delete quoteParams[key];
      }
    });

    return quoteParams;
  }

  static isValidQuoteParams(params: ZeroXQuoteV2Params) {
    const sellToken = ZeroX.sdk.tokens.findByAddress(params.sellToken);

    if (!sellToken) {
      return false;
    }

    const sellAmount = sellToken.fromHuman(params.sellAmount);

    if (
      !params.chainId ||
      !params.buyToken ||
      !params.sellToken ||
      !sellAmount.gt(0) ||
      !isAddress(params.buyToken) ||
      !isAddress(params.sellToken)
    ) {
      return false;
    }

    return true;
  }

  static slippageToSlippageBps(slippage: number | string) {
    try {
      return Number(slippage.toString()) * 100;
    } catch (e) {
      throw new Error(`Invalid slippage input: ${slippage}`);
    }
  }
}
