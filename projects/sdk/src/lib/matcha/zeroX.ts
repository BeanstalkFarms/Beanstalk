import { ZeroExAPIRequestParams, ZeroExQuoteResponse } from "./types";

export class ZeroX {
  readonly swapV1Endpoint = "https://arbitrum.api.0x.org/swap/v1/quote";

  constructor(private _apiKey: string = "") {}

  /**
   * Exposing here to allow other modules to use their own API key if needed
   */
  setApiKey(_apiKey: string) {
    this._apiKey = _apiKey;
  }

  /**
   * fetch the quote from the 0x API
   * @notes defaults:
   *  - slippagePercentage: In human readable form. 0.01 = 1%. Defaults to 0.001 (0.1%)
   *  - skipValidation: defaults to true
   *  - shouldSellEntireBalance: defaults to false
   */
  async fetchSwapQuote<T extends ZeroExAPIRequestParams = ZeroExAPIRequestParams>(
    args: T,
    requestInit?: Omit<RequestInit, "headers" | "method">
  ): Promise<ZeroExQuoteResponse> {
    if (!this._apiKey) {
      throw new Error("Cannot fetch from 0x without an API key");
    }

    const fetchParams = new URLSearchParams(
      this.generateQuoteParams(args) as unknown as Record<string, string>
    );

    const options = {
      ...requestInit,
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        Accept: "application/json",
        "0x-api-key": this._apiKey
      })
    };

    const url = `${this.swapV1Endpoint}?${fetchParams.toString()}`;

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
}
