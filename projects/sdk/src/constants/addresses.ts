import { Address } from "src/classes/Address";
export const addresses = {
  // ----------------------------------------
  // Beanstalk Core Contracts
  // ----------------------------------------
  BEANSTALK: Address.make("0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5"),
  BEANSTALK_FERTILIZER: Address.make("0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6"),
  BARNRAISE_CUSTODIAN: Address.make("0xa9bA2C40b263843C04d344727b954A545c81D043"),

  // ----------------------------------------
  // Ecosystem Contracts
  // ----------------------------------------
  BEANSTALK_PRICE: Address.make("0xF2C2b7eabcB353bF6f2128a7f8e1e32Eeb112530"),
  MATH: Address.make("0x16a903b66403d3de69db50e6d1ad0b07490b740a"),
  DEPOT: Address.make("0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2"),
  PIPELINE: Address.make("0xb1bE0000C6B3C62749b5F0c92480146452D15423"),
  ROOT: Address.make("0x77700005BEA4DE0A78b956517f099260C2CA9a26"),

  // ----------------------------------------
  // BeaNFT Contracts
  // ----------------------------------------
  BEANFT_GENESIS: Address.make("0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79"),
  BEANFT_WINTER_ADDRESSES: Address.make("0x459895483556daD32526eFa461F75E33E458d9E9"),

  // ----------------------------------------
  // Bean & Unripe Bean Tokens
  // ----------------------------------------
  BEAN: Address.make("0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab"),
  UNRIPE_BEAN:
    // "Unripe Bean": Unripe vesting asset for the Bean token, Localhost
    Address.make("0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449"),
  UNRIPE_BEAN_CRV3:
    // "Unripe BEAN:CRV3 LP": Unripe vesting asset for the BEAN:CRV3 LP token, Localhost
    Address.make("0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D"),

  // ----------------------------------------
  // Bean Pool LP Tokens
  // ----------------------------------------
  BEAN_CRV3:
    // "Curve.fi Factory USD Metapool: Bean (BEAN3CRV-f)"
    // [Implements: ERC20 & Metapool]
    // --------------------------------------------------
    // coins[0] = 0xBEA0003eA948Db32082Fc6F4EC0729D258a0444c (BEAN)
    // coins[1] = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490 (3CRV)
    //
    // 1. Creates a BEAN:3CRV Metapool contract.
    // 2. Issues BEAN3CRV-f, the pool's LP token. The pool address and
    //    the LP token address are identical. Note that this is NOT the
    //    case for 3pool itself on Mainnet:
    //    - 3CRV (the 3pool LP Token) = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490
    //    - 3pool Contract            = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7
    Address.make("0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49"),

  // ----------------------------------------
  // Wells Contracts
  // ----------------------------------------
  BEANWETH_WELL: Address.make("0xb468647b04bf657c9ee2de65252037d781eabafd"),

  // ----------------------------------------
  // Common ERC-20 Tokens
  // ----------------------------------------
  WETH: Address.make("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  DAI: Address.make("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
  USDC: Address.make("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  USDT: Address.make("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
  CRV3: Address.make("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490"),
  LUSD: Address.make("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0"),

  // ----------------------------------------
  // Curve Pools: Other
  // ----------------------------------------
  // --------------------------------------------------
  POOL3:
    // "Curve.fi: DAI/USDC/USDT Pool" (aka 3pool)
    // --------------------------------------------------
    // coins[0] = 0x6B175474E89094C44Da98b954EedeAC495271d0F (DAI)
    // coins[1] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
    // coins[2] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
    Address.make("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"),
  TRICRYPTO2:
    // tricrypto2
    // --------------------------------------------------
    // coins[0] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
    // coins[1] = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 (WBTC)
    // coins[2] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
    Address.make("0xD51a44d3FaE010294C616388b506AcdA1bfAAE46"),

  // ----------------------------------------
  // Curve: Registries / Factories / Utils
  // ----------------------------------------
  // "metapool" and "cryptoswap" are simultaneously
  // - "registries" (they track a list of pools)
  // - "factories"  (they allow creation of new pools)

  // 3pool, etc.
  POOL_REGISTRY: Address.make("0x90e00ace148ca3b23ac1bc8c240c2a7dd9c2d7f5"),

  // X:3CRV, etc. aka StableFactory
  META_FACTORY: Address.make("0xB9fC157394Af804a3578134A6585C0dc9cc990d4"),

  // tricrypto2, etc.
  CRYPTO_FACTORY: Address.make("0x8F942C20D02bEfc377D41445793068908E2250D0"),

  // zap
  CURVE_ZAP: Address.make("0xA79828DF1850E8a3A3064576f380D90aECDD3359"),

  // BEAN_ETH_UNIV2_LP !! Deprecated
  BEAN_ETH_UNIV2_LP: Address.make("0x87898263B6C5BABe34b4ec53F22d98430b91e371"),

  // BEAN_LUSD_LP !! Deprecated
  BEAN_LUSD_LP: Address.make("0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D")
};
