import Bottleneck from "bottleneck";
import { ZeroExAPIRequestParams, ZeroExQuoteResponse } from "./types";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { fetchWithBottleneckLimiter, isRateLimitError } from "./utils";

const RETRY_AFTER_MS = 200;

const MAX_RETRY_COUNT = 10;

type RequestParams = Omit<RequestInit, "headers" | "method">;

export class ZeroX {
  static sdk: BeanstalkSDK;

  private static limiter: Bottleneck;

  readonly swapV1Endpoint = "https://arbitrum.api.0x.org/swap/v1/quote";

  constructor(
    sdk: BeanstalkSDK,
    private _apiKey: string = ""
  ) {
    ZeroX.sdk = sdk;

    // Keep the limiter in memory across instances to avoid request leaks between re-initializations of the SDK
    if (!ZeroX.limiter) {
      ZeroX.limiter = ZeroX.initializeLimiter();
    }
  }

  /**
   * Exposing here to allow other modules to use their own API key if needed
   */
  setApiKey(_apiKey: string) {
    this._apiKey = _apiKey;
  }

  /**
   * Fetches quotes from the 0x API
   *
   * @note Utilizes Bottleneck limiter to prevent rate limiting.
   * - In the case of a rate limit, it will retry until up to 10 times every 200ms.
   *
   * @param args - a single request or an array of requests
   * @param requestInit - optional request init params
   * @returns
   */
  async quote<T extends ZeroExAPIRequestParams = ZeroExAPIRequestParams>(
    args: T | T[],
    requestInit?: RequestParams
  ): Promise<ZeroExQuoteResponse[]> {
    this.validateAPIKey();

    const fetchArgs = Array.isArray(args) ? args : [args];

    const requests = fetchArgs.map((params) => {
      const urlParams = new URLSearchParams(
        this.generateQuoteParams(params) as unknown as Record<string, string>
      );

      return {
        id: this.generateRequestId(params),
        request: () => this.send0xRequest(urlParams, requestInit)
      };
    });

    return fetchWithBottleneckLimiter<ZeroExQuoteResponse>(ZeroX.limiter, requests);
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
        Accept: "application/json",
        "0x-api-key": this._apiKey
      })
    };

    const url = `${this.swapV1Endpoint}?${urlParams.toString()}`;

    return fetch(url, options).then((r) => r.json()) as Promise<ZeroExQuoteResponse>;
  }

  /**
   * Generate the params for the 0x API
   * @throws if required params are missing
   *
   * @returns the params for the 0x API
   */
  private generateQuoteParams<T extends ZeroExAPIRequestParams = ZeroExAPIRequestParams>(
    params: T
  ): ZeroExAPIRequestParams {
    if (!params.buyToken && !params.sellToken) {
      throw new Error("buyToken and sellToken and required");
    }

    if (!params.sellAmount && !params.buyAmount) {
      throw new Error("sellAmount or buyAmount is required");
    }

    const quoteParams = {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      buyAmount: params.buyAmount,
      slippagePercentage: params.slippagePercentage ?? "0.01",
      gasPrice: params.gasPrice,
      takerAddress: params.takerAddress,
      excludedSources: params.excludedSources,
      includedSources: params.includedSources,
      skipValidation: params.skipValidation ?? true, // defaults to true b/c most of our swaps go through advFarm / pipeline calls
      feeRecipient: params.feeRecipient,
      buyTokenPercentageFee: params.buyTokenPercentageFee,
      priceImpactProtectionPercentage: params.priceImpactProtectionPercentage,
      feeRecipientTradeSurplus: params.feeRecipientTradeSurplus,
      shouldSellEntireBalance: params.shouldSellEntireBalance ?? false
    };

    Object.keys(quoteParams).forEach((_key) => {
      const key = _key as keyof typeof quoteParams;
      if (quoteParams[key] === undefined || quoteParams[key] === null) {
        delete quoteParams[key];
      }
    });

    return quoteParams;
  }

  private generateRequestId<T extends ZeroExAPIRequestParams = ZeroExAPIRequestParams>(args: T) {
    const sellToken = args.sellToken || "";
    const buyToken = args.buyToken || "";
    const sellAmount = args.sellAmount || "0";
    const buyAmount = args.buyAmount || "0";
    const slippagePercentage = args.slippagePercentage || "0.01";
    const timestamp = new Date().getTime();

    return `0x-${sellToken}-${buyToken}-${sellAmount}-${buyAmount}-${slippagePercentage}-${timestamp}`;
  }

  private static initializeLimiter() {
    // 0x has rate limit of 10 requests per second.
    // We set the reservoir to 4, so we can make 4 requests per every 500ms, with a minimum of 125ms between each request.
    const limiter = new Bottleneck({
      reservoir: 4,
      reservoirRefreshInterval: 500,
      reservoirRefreshAmount: 4,
      maxConcurrent: 4,
      minTime: 125
    });

    limiter.on("failed", (error, info) => {
      // If we are being rate limited, retry after 100ms. We try until we get a successful response
      if (isRateLimitError(error)) {
        ZeroX.sdk.debug("[ZeroX Limiter]: quote failed: ... retrying id: ", info.options.id);
        if (info.retryCount < MAX_RETRY_COUNT) {
          return RETRY_AFTER_MS;
        }
        return null;
      }

      // Non rate limit errors are not retried
      return null;
    });

    return limiter;
  }

  private validateAPIKey() {
    if (!this._apiKey) {
      throw new Error("Cannot fetch from 0x without an API key");
    }
  }
}
