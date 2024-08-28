import { CurveMetaPool } from "src/classes/Pool/CurveMetaPool";
import { BasinWell } from "src/classes/Pool/BasinWell";
import Pool from "src/classes/Pool/Pool";
import { ERC20Token, Token } from "src/classes/Token";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";

export class Pools {
  static sdk: BeanstalkSDK;
  public readonly BEAN_ETH_WELL: BasinWell;
  public readonly BEAN_WSTETH_WELL: BasinWell;
  public readonly BEAN_WEETH_WELL: BasinWell;
  public readonly BEAN_WBTC_WELL: BasinWell;
  public readonly BEAN_USDC_WELL: BasinWell;
  public readonly BEAN_USDT_WELL: BasinWell;

  public readonly pools: Set<Pool>;
  public readonly whitelistedPools: Map<string, Pool>;

  private lpAddressMap = new Map<string, Pool>();
  private wellAddressMap = new Map<string, BasinWell>();

  constructor(sdk: BeanstalkSDK) {
    Pools.sdk = sdk;
    this.pools = new Set<Pool>();
    this.lpAddressMap = new Map();
    this.whitelistedPools = new Map();

    ////// Basin Well

    this.BEAN_ETH_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANWETH_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_ETH_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.WETH],
      {
        name: "Basin BEAN:ETH Well",
        logo: "",
        symbol: "BEAN:ETH",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_ETH_WELL);
    this.lpAddressMap.set(this.BEAN_ETH_WELL.address, this.BEAN_ETH_WELL);

    this.BEAN_WSTETH_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANWSTETH_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_WSTETH_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.WSTETH],
      {
        name: "Basin BEAN:wstETH Well",
        logo: "",
        symbol: "BEAN:wstETH",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_WSTETH_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_WSTETH_WELL_LP.address, this.BEAN_WSTETH_WELL);

    this.BEAN_WEETH_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANWEETH_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_WEETH_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.WEETH],
      {
        name: "Basin BEAN:weETH Well",
        logo: "",
        symbol: "BEAN:weETH",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_WEETH_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_WEETH_WELL_LP.address, this.BEAN_WEETH_WELL);

    this.BEAN_WBTC_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANWBTC_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_WBTC_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.WBTC],
      {
        name: "Basin BEAN:wBTC Well",
        logo: "",
        symbol: "BEAN:WBTC",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_WBTC_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_WBTC_WELL_LP.address, this.BEAN_WBTC_WELL);

    this.BEAN_USDC_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANUSDC_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_USDC_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.USDC],
      {
        name: "Basin BEAN:USDC Well",
        logo: "",
        symbol: "BEAN:USDC",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_USDC_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_USDC_WELL_LP.address, this.BEAN_USDC_WELL);

    this.BEAN_USDT_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANUSDT_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_USDT_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.USDT],
      {
        name: "Basin BEAN:USDT Well",
        logo: "",
        symbol: "BEAN:USDT",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_USDT_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_USDT_WELL_LP.address, this.BEAN_USDT_WELL);

    this.lpAddressMap.forEach((pool) => {
      if (Pools.sdk.tokens.siloWhitelist.has(pool.lpToken)) {
        this.whitelistedPools.set(pool.address, pool);
      }

      if (pool instanceof BasinWell) {
        this.wellAddressMap.set(pool.address, pool);
      }
    });
  }

  isWhitelisted(pool: Pool | string): boolean {
    const _pool = this.derivePool(pool);
    return this.whitelistedPools.has(_pool.address);
  }

  getPoolByLPToken(token: Token | string): Pool | undefined {
    if (typeof token === "string") {
      return this.lpAddressMap.get(token.toLowerCase());
    }
    return this.lpAddressMap.get(token.address);
  }

  getWells(): readonly BasinWell[] {
    return Array.from(this.wellAddressMap.values()) as ReadonlyArray<BasinWell>;
  }

  /**
   * Derives a Pool object from either a Pool object or a pool address.
   * @param pool - Either a Pool object or a string representing the pool's address.
   * @returns The corresponding Pool object.
   * @throws Error if a pool with the given address is not found in the lpAddressMap.
   */
  private derivePool(pool: Pool | string): Pool {
    if (typeof pool === "string") {
      const _pool = this.lpAddressMap.get(pool.toLowerCase());
      if (!_pool) {
        throw new Error(`Pool with address ${pool} not found`);
      }
      return _pool;
    }
    return pool;
  }
}
