import { TokenValue } from "@beanstalk/sdk-core";
import { ERC20Token, Token } from "src/classes/Token";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { BeanstalkPrice } from "src/constants/generated";

interface PricePoolData {
  address: string;
  price: TokenValue;
  reserves: TokenValue[];
  deltaB: TokenValue;
  liquidity: TokenValue;
  lpUsd: TokenValue;
  lpBdv: TokenValue;
}

/** The maximum amount of time in milliseconds that the prices and pool data can be stale before they are refreshed. */
const MAX_STALE_TIME = 1000 * 60 * 15; // 15 mins;

// prettier-ignore
export class BeanSwapPriceCache {
  private static sdk: BeanstalkSDK;

  /** Mapping of non-bean tokens to their price. */
  private erc20Prices: Map<Token, TokenValue>;

  /** Mapping of wells to their respective pool data fetched from the Beanstalk Price Contract. */
  private poolData: Map<BasinWell, PricePoolData>;

  /** Timestamp of the last time the prices of non-bean tokens were updated. Instantaneous prices are fetched from the Beanstalk contract. */
  private pricesLastUpdated: number;

  // ---------- Constructor ---------- //
  constructor(sdk: BeanstalkSDK) {
    BeanSwapPriceCache.sdk = sdk;
    this.erc20Prices = new Map();
    this.poolData = new Map();
    this.pricesLastUpdated = 0;
  }

  // ---------- Public Methods ---------- //

  getTokenUsd(token: Token) {
    return this.erc20Prices.get(token) ?? TokenValue.fromBlockchain(0, 6);
  }

  /**
   * @param well - The well to get the pool data for.
   * @returns The pool data from the Beanstalk Price Contract for given Well.
   */
  getWellPoolData(well: BasinWell) {
    return this.poolData.get(well);
  }

  /**
   * Verifies that the reserves and prices for a given well are up to date.
   * @param well - The well to verify the reserves and prices for.
   * @returns True if the reserves and prices exist, false otherwise.
   * 
   * @notes This method checks the BEAN price to the BEAN price respective to the Well. 
   */
  hasReservesAndPrices(well: BasinWell) {
    const poolData = this.poolData.get(well);
    const nonBeanUnderlying = well.getPairToken(BeanSwapPriceCache.sdk.tokens.BEAN);

    const hasReserves = poolData?.reserves?.every((r) => r.gt(0));
    const hasBeanPrice = poolData?.price.gt(0);
    const hasNonBeanUnderlyingPrice = !!this.getTokenUsd(nonBeanUnderlying);

    return Boolean(hasReserves && hasBeanPrice && hasNonBeanUnderlyingPrice);
  }

  /**
   * Refreshes the reserves and prices for all wells and their underlying tokens if the last refresh was more than 15 minutes ago.
   * @param force - If true, the reserves and prices will be refreshed regardless of the time since the last refresh.
   * @returns True if the reserves and prices were refreshed, false otherwise.
   */
  async refresh(force?: boolean) {
    const diff = Date.now() - this.pricesLastUpdated;
    const refreshing = force || diff > MAX_STALE_TIME;

    if (!refreshing) return false;
    await this.refreshPricesAndPoolDatas();
    return true;
  }

  // ---------- Private Methods ---------- //

  /**
   * Refreshes the reserves and prices for all wells.
   */
  private async refreshPricesAndPoolDatas() {
    const response = await BeanSwapPriceCache.sdk.contracts.beanstalk.callStatic.advancedPipe(
      this.constructRefreshPipeCalls(),
      "0"
    );
    BeanSwapPriceCache.sdk.debug("[BeanSwapV2/refreshReservesAndPrices] AdvPipeResult:", response);

    const result = this.processRefreshPipeCallResults(response);

    this.poolData = result.priceResult.poolData;
    this.erc20Prices = result.tokenPrices;
    this.pricesLastUpdated = Date.now();
  }
  private constructRefreshPipeCalls() {
    const pipeCalls: AdvancedPipeCallStruct[] = [];

    // Beanstalk Price
    pipeCalls.push({
      target: BeanSwapPriceCache.sdk.contracts.beanstalkPrice.address,
      callData: BeanSwapPriceCache.sdk.contracts.beanstalkPrice.interface.encodeFunctionData("price"),
      clipboard: Clipboard.encode([])
    });

    // Token USD Prices
    this.getWellsNonBeanUnderlying().forEach((token) => {
      pipeCalls.push({
        target: BeanSwapPriceCache.sdk.contracts.beanstalk.address,
        callData: BeanSwapPriceCache.sdk.contracts.beanstalk.interface.encodeFunctionData("getTokenUsdPrice", [token.address]),
        clipboard: Clipboard.encode([])
      });
    });

    BeanSwapPriceCache.sdk.debug("[BeanSwapPriceCache/constructRefreshPipeCalls] PipeCalls: ", pipeCalls);

    return pipeCalls;
  }

  private processRefreshPipeCallResults(results: string[]) {
    const [beanstalkPriceData, ...tokenPriceResults] = results;
    const tokenPrices = new Map<Token, TokenValue>();

    const priceResult = this.decodeBeanstalkPrice(beanstalkPriceData);
    tokenPrices.set(BeanSwapPriceCache.sdk.tokens.BEAN, priceResult.beanPrice);

    for (const [i, token] of this.getWellsNonBeanUnderlying().entries()) {
      const decodedPrice = this.decodeGetTokenUsdPrice(tokenPriceResults[i]);
      tokenPrices.set(token, decodedPrice);
      if (token.equals(BeanSwapPriceCache.sdk.tokens.WETH)) {
        tokenPrices.set(BeanSwapPriceCache.sdk.tokens.ETH, decodedPrice);
      }
    }

    return {
      tokenPrices,
      priceResult
    };
  }

  // ---------- Decode Methods ---------- //

  /**
   * Decodes the result of the getTokenUsdPrice function.
   */
  private decodeGetTokenUsdPrice(result: string) {
    try {
      const priceDecoded = BeanSwapPriceCache.sdk.contracts.beanstalk.interface.decodeFunctionResult(
        "getTokenUsdPrice", 
        result
      )[0];

      return TokenValue.fromBlockchain(priceDecoded, 6);
    } catch (e) {
      BeanSwapPriceCache.sdk.debug(`[BeanSwapPriceCache/decodeGetTokenUsdPrice] Error decoding getTokenUsdPrice`, e);
      throw e;
    }
  }

  /**
   * Decodes the result of the Beanstalk Price contract's price function.
   */
  private decodeBeanstalkPrice(result: string) {
    const poolData = new Map<BasinWell, PricePoolData>();

    try {
      const decoded = BeanSwapPriceCache.sdk.contracts.beanstalkPrice.interface.decodeFunctionResult(
        "price", 
        result
      )[0] as BeanstalkPrice.PricesStructOutput;

      const beanPrice = BeanSwapPriceCache.sdk.tokens.BEAN.fromBlockchain(decoded.price);

      for (const pool of decoded.ps) {
        const well = BeanSwapPriceCache.sdk.pools.getWellByLPToken(pool.pool);
        if (!well) {
          continue;
        }

        const data: PricePoolData = {
          address: well.address.toLowerCase(),
          price: TokenValue.fromBlockchain(pool.price, 6),
          reserves: [
            well.tokens[0].fromBlockchain(pool.balances[0]),
            well.tokens[1].fromBlockchain(pool.balances[1])
          ],
          deltaB: TokenValue.fromBlockchain(pool.deltaB, 6),
          liquidity: TokenValue.fromBlockchain(pool.liquidity, 6),
          lpUsd: TokenValue.fromBlockchain(pool.lpUsd, 6),
          lpBdv: BeanSwapPriceCache.sdk.tokens.BEAN.fromBlockchain(pool.lpBdv)
        };

        poolData.set(well, data);
      }

      BeanSwapPriceCache.sdk.debug("[BeanSwapPriceCache/decodeBeanstalkPrice]: RESULT", {
        beanPrice,
        poolData
      });

      return {
        beanPrice,
        poolData
      };
    } catch (e) {
      BeanSwapPriceCache.sdk.debug("Error decoding Beanstalk Price contract result", e);
      throw e;
    }
  }

  private getWellsNonBeanUnderlying() {
    const wells = BeanSwapPriceCache.sdk.pools.getWells();

    const tokens = new Set<ERC20Token>(wells.map((well) => well.tokens).flat());

    tokens.delete(BeanSwapPriceCache.sdk.tokens.BEAN);
    return [...tokens];
  }
}
