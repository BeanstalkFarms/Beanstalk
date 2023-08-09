import { CurveMetaPool } from "src/classes/Pool/CurveMetaPool";
import { BasinWell } from "src/classes/Pool/BasinWell";
import Pool from "src/classes/Pool/Pool";
import { Token } from "src/classes/Token";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";

export class Pools {
  static sdk: BeanstalkSDK;
  public readonly BEAN_CRV3: CurveMetaPool;
  public readonly BEAN_ETH_WELL: BasinWell;

  public readonly pools: Set<Pool>;

  private lpAddressMap = new Map<string, Pool>();

  constructor(sdk: BeanstalkSDK) {
    Pools.sdk = sdk;
    this.pools = new Set();
    this.lpAddressMap = new Map();

    ////// Curve Meta Pool

    // The pool contract address should be exactly
    // the same as the LP token's address
    this.BEAN_CRV3 = new CurveMetaPool(
      sdk,
      sdk.addresses.BEAN_CRV3.get(sdk.chainId),
      sdk.tokens.BEAN_CRV3_LP,
      [sdk.tokens.BEAN, sdk.tokens.CRV3],
      {
        name: "BEAN:3CRV Pool",
        logo: "",
        symbol: "BEAN:3CRV",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_CRV3);
    this.lpAddressMap.set(sdk.tokens.BEAN_CRV3_LP.address.toLowerCase(), this.BEAN_CRV3);

    ////// Basin Well

    this.BEAN_ETH_WELL = new BasinWell(
      sdk,
      sdk.addresses.BEANWETH_WELL.get(sdk.chainId),
      sdk.tokens.BEAN_ETH_WELL_LP,
      [sdk.tokens.BEAN, sdk.tokens.WETH],
      {
        name: "Basin Bean:ETH Well",
        logo: "",
        symbol: "BEAN:ETH",
        color: "#ed9f9c"
      }
    );
    this.pools.add(this.BEAN_ETH_WELL);
    this.lpAddressMap.set(sdk.tokens.BEAN_ETH_WELL_LP.address.toLowerCase(), this.BEAN_ETH_WELL);
  }

  getPoolByLPToken(token: Token): Pool | undefined {
    return this.lpAddressMap.get(token.address);
  }
}
