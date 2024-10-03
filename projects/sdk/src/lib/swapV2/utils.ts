import { TokenValue } from "@beanstalk/sdk-core";

import { BasinWell } from "src/classes/Pool";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { BeanstalkPrice } from "src/constants/generated";

import { PricePoolData } from "./types";

export function decodeTokenPriceResult(sdk: BeanstalkSDK, result: string) {
  try {
    const priceDecoded = sdk.contracts.beanstalk.interface.decodeFunctionResult(
      "getTokenUsdPrice",
      result
    )[0];

    return TokenValue.fromBlockchain(priceDecoded, 6);
  } catch (e) {
    sdk.debug(`[BeanSwapV2/decodeTokenPriceResult] Error decoding getTokenUsdPrice for result: ${result}`, e);
    throw e;
  }
}

export function decodePriceContractResult(sdk: BeanstalkSDK, result: string) {
  const map = new Map<BasinWell, PricePoolData>();

  try {
    const decoded = sdk.contracts.beanstalkPrice.interface.decodeFunctionResult(
      "price",
      result
    )[0] as BeanstalkPrice.PricesStructOutput;

    const beanPrice = sdk.tokens.BEAN.fromBlockchain(decoded.price);

    for (const pool of decoded.ps) {
      const well = sdk.pools.getWellByLPToken(pool.pool);
      if (!well) continue;

      const poolPriceResult: PricePoolData = {
        well,
        address: pool.pool.toLowerCase(),
        price: TokenValue.fromBlockchain(pool.price, 6),
        reserves: [
          well.tokens[0].fromBlockchain(pool.balances[0]),
          well.tokens[1].fromBlockchain(pool.balances[1])
        ] as [TokenValue, TokenValue],
        deltaB: TokenValue.fromBlockchain(pool.deltaB, 6),
        liquidity: TokenValue.fromBlockchain(pool.liquidity, 6),
        lpUsd: TokenValue.fromBlockchain(pool.lpUsd, 6),
        lpBdv: sdk.tokens.BEAN.fromBlockchain(pool.lpBdv)
      };

      map.set(well, poolPriceResult);
    }

    return {
      beanPrice,
      poolData: map
    };
  } catch (e) {
    console.error("[BeanSwapV2/decodePriceContractResult] Error decoding Price contract result", e);
    throw e;
  }
}
