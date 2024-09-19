import { ZeroExAPIRequestParams, ZeroExQuoteParams, ZeroExQuoteResponse } from "./types";

export class ZeroX {
  readonly swapV1Endpoint = "http://arbitrum.api.0x.org/swap/v1/quote";

  constructor(private _apiKey: string = "") {}

  /**
   * fetch the quote from the 0x API
   *
   * params
   *  - slippagePercentage: In human readable form. 0.01 = 1%. Defaults to 0.001 (0.1%)
   *  - skipValidation: defaults to true
   *  - shouldSellEntireBalance: defaults to false
   */
  async fetchQuote(args: ZeroExQuoteParams) {
    if (!this._apiKey) {
      throw new Error("Cannot fetch from 0x without an API key");
    }

    const fetchParams = new URLSearchParams(
      this.generateQuoteParams(args) as unknown as Record<string, string>
    );

    const options = {
      method: "GET",
      headers: new Headers({
        "0x-api-key": this._apiKey
      })
    };

    const url = `${this.swapV1Endpoint}?${fetchParams.toString()}`;

    return fetch(url, options).then((r) => r.json()) as Promise<ZeroExQuoteResponse>;
  }

  private generateQuoteParams(args: ZeroExQuoteParams): ZeroExAPIRequestParams {
    const { enabled, mode, ...params } = args;

    if (!params.buyToken && !params.sellToken) {
      throw new Error("buyToken and sellToken and required");
    }

    if (!params.sellAmount && !params.buyAmount) {
      throw new Error("sellAmount or buyAmount is required");
    }

    return {
      ...params,
      slippagePercentage: params.slippagePercentage ?? "0.01",
      skipValidation: params.skipValidation ?? true,
      shouldSellEntireBalance: params.shouldSellEntireBalance ?? false
    };
  }
}
