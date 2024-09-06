import { ChainId, Address } from "@beanstalk/sdk-core";

export const addresses = {
  // ----------------------------------------
  // Beanstalk Core Contracts
  // ----------------------------------------
  BEANSTALK: Address.make({
    [ChainId.ETH_MAINNET]: "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5",
    [ChainId.ARBITRUM_MAINNET]: "0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70"
  }),
  BEANSTALK_FERTILIZER: Address.make({
    [ChainId.ETH_MAINNET]: "0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6",
    [ChainId.ARBITRUM_MAINNET]: "0x82a17bdeC3368f549A7BfE6734D6E2Aba82be455" // FIX ME
  }),
  BARNRAISE_CUSTODIAN: Address.make({
    [ChainId.ETH_MAINNET]: "0xa9bA2C40b263843C04d344727b954A545c81D043"
  }),

  // ----------------------------------------
  // Ecosystem Contracts
  // ----------------------------------------
  BEANSTALK_PRICE: Address.make({
    [ChainId.ETH_MAINNET]: "0xb01CE0008CaD90104651d6A84b6B11e182a9B62A",
    [ChainId.ARBITRUM_MAINNET]: "0xEfE94bE746681ed73DfD15F932f9a8e8ffDdEE56"
  }),
  JUNCTION: Address.make({
    [ChainId.ETH_MAINNET]: "0x16a903b66403d3de69db50e6d1ad0b07490b740a",
    [ChainId.ARBITRUM_MAINNET]: "0x5A5A5ADe4C9713172a5228703213d4D39608E2cD"
  }),
  DEPOT: Address.make({
    [ChainId.ETH_MAINNET]: "0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2",
    [ChainId.ARBITRUM_MAINNET]: "0xDEb0f0dEEc1A29ab97ABf65E537452D1B00A619c"
  }),
  PIPELINE: Address.make({
    [ChainId.ETH_MAINNET]: "0xb1bE0000C6B3C62749b5F0c92480146452D15423",
    [ChainId.ARBITRUM_MAINNET]: "0xb1bE000644bD25996b0d9C2F7a6D6BA3954c91B0"
  }),
  UNWRAP_AND_SEND_ETH: Address.make({
    [ChainId.ETH_MAINNET]: "0x737Cad465B75CDc4c11B3E312Eb3fe5bEF793d96",
    [ChainId.ARBITRUM_MAINNET]: "0xD6Fc4a63d7E93267c3007eA176081052369A4749"
  }),

  /** @deprecated */
  USD_ORACLE: Address.make({
    [ChainId.ETH_MAINNET]: "0x1aa19ed7DfC555E4644c9353Ad383c33024855F7"
  }),
  /** @deprecated */
  ROOT: Address.make({
    [ChainId.ETH_MAINNET]: "0x77700005BEA4DE0A78b956517f099260C2CA9a26"
  }),

  // ----------------------------------------
  // BeaNFT Contracts
  // ----------------------------------------
  BEANFT_GENESIS: Address.make({
    [ChainId.ETH_MAINNET]: "0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79"
  }),
  BEANFT_WINTER_ADDRESSES: Address.make({
    [ChainId.ETH_MAINNET]: "0x459895483556daD32526eFa461F75E33E458d9E9"
  }),

  // ----------------------------------------
  // Bean & Unripe Bean Tokens
  // ----------------------------------------
  BEAN: Address.make({
    [ChainId.ETH_MAINNET]: "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab",
    [ChainId.ARBITRUM_MAINNET]: "0xBEA0005B8599265D41256905A9B3073D397812E4"
  }),
  UNRIPE_BEAN:
    // "Unripe Bean": Unripe vesting asset for the Bean token, Localhost
    Address.make({
      [ChainId.ETH_MAINNET]: "0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449",
      [ChainId.ARBITRUM_MAINNET]: "0x1BEA054dddBca12889e07B3E076f511Bf1d27543"
    }),
  UNRIPE_BEAN_WSTETH:
    // "Unripe BEAN:WETH LP": Unripe vesting asset for the BEAN:WETH LP token, Localhost
    Address.make({
      [ChainId.ETH_MAINNET]: "0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D",
      [ChainId.ARBITRUM_MAINNET]: "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788"
    }),

  // ----------------------------------------
  // Bean Pool LP Tokens
  // ----------------------------------------
  /**
   * @deprecated
   */
  BEAN_CRV3:
    // "BEAN:3CRV Curve LP Token (BEAN3CRV-f)"
    // [Implements: ERC20 & Metapool]
    // --------------------------------------------------
    // coins[0] = 0xBEA0003eA948Db32082Fc6F4EC0729D258a0444c (BEAN)
    //
    // 1. Creates a BEAN:3CRV Metapool contract.
    // 2. Issues BEAN3CRV-f, the pool's LP token. The pool address and
    //    the LP token address are identical. Note that this is NOT the
    //    case for 3pool itself on Mainnet:
    //    - 3CRV (the 3pool LP Token) = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490
    //    - 3pool Contract            = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7
    Address.make({
      [ChainId.ETH_MAINNET]: "0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49"
    }),

  // ----------------------------------------
  // Wells Contracts
  // ----------------------------------------
  BEANWETH_WELL: Address.make({
    [ChainId.ETH_MAINNET]: "0xBEA0e11282e2bB5893bEcE110cF199501e872bAd",
    [ChainId.ARBITRUM_MAINNET]: "0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB"
  }),
  BEANWSTETH_WELL: Address.make({
    [ChainId.ETH_MAINNET]: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    [ChainId.ARBITRUM_MAINNET]: "0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8"
  }),
  BEANWEETH_WELL: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xBEA00865405A02215B44eaADB853d0d2192Fc29D"
  }),
  BEANWBTC_WELL: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA"
  }),
  BEANUSDC_WELL: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279"
  }),
  BEANUSDT_WELL: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b"
  }),

  // ----------------------------------------
  // Common ERC-20 Tokens
  // ----------------------------------------
  WETH: Address.make({
    [ChainId.ETH_MAINNET]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    [ChainId.ARBITRUM_MAINNET]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
  }),
  WSTETH: Address.make({
    [ChainId.ETH_MAINNET]: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    [ChainId.ARBITRUM_MAINNET]: "0x5979D7b546E38E414F7E9822514be443A4800529"
  }),
  WEETH: Address.make({
    [ChainId.ETH_MAINNET]: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    [ChainId.ARBITRUM_MAINNET]: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe"
  }),
  WBTC: Address.make({
    [ChainId.ETH_MAINNET]: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    [ChainId.ARBITRUM_MAINNET]: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
  }),
  DAI: Address.make({
    [ChainId.ETH_MAINNET]: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    [ChainId.ARBITRUM_MAINNET]: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
  }),
  USDC: Address.make({
    [ChainId.ETH_MAINNET]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    [ChainId.ARBITRUM_MAINNET]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  }),
  USDT: Address.make({
    [ChainId.ETH_MAINNET]: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    [ChainId.ARBITRUM_MAINNET]: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
  }),
  CRV3: Address.make({
    [ChainId.ETH_MAINNET]: "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490"
  }),
  LUSD: Address.make({
    [ChainId.ETH_MAINNET]: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0"
  }),
  STETH: Address.make({
    [ChainId.ETH_MAINNET]: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
  }),
  ARB: Address.make({
    [ChainId.ETH_MAINNET]: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1",
    [ChainId.ARBITRUM_MAINNET]: "0x912CE59144191C1204E64559FE8253a0e49E6548"
  }),
  RETH: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8"
  }),
  GMX: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a"
  }),
  PENDLE: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8"
  }),
  ZRO: Address.make({
    [ChainId.ARBITRUM_MAINNET]: "0x6985884C4392D348587B19cb9eAAf157F13271cd"
  }),

  // ----------------------------------------
  // Curve Pools: Other
  // ----------------------------------------
  // --------------------------------------------------
  /**
   * @deprecated
   * Curve.fi: DAI/USDC/USDT Pool
   */
  POOL3:
    // "Curve.fi: DAI/USDC/USDT Pool" (aka 3pool)
    // --------------------------------------------------
    // coins[0] = 0x6B175474E89094C44Da98b954EedeAC495271d0F (DAI)
    // coins[1] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
    // coins[2] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
    Address.make({
      [ChainId.ETH_MAINNET]: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"
    }),
  /**
   * @deprecated
   * tricrypto2
   */
  /**
   * @deprecated
   */
  TRICRYPTO2:
    // tricrypto2
    // --------------------------------------------------
    // coins[0] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
    // coins[1] = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 (WBTC)
    // coins[2] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
    Address.make({
      [ChainId.ETH_MAINNET]: "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46"
    }),

  // ----------------------------------------
  // Curve: Registries / Factories / Utils
  // ----------------------------------------
  // "metapool" and "cryptoswap" are simultaneously
  // - "registries" (they track a list of pools)
  // - "factories"  (they allow creation of new pools)

  /**
   * @deprecated
   * 3pool, etc.
   */
  POOL_REGISTRY: Address.make({
    [ChainId.ETH_MAINNET]: "0x90e00ace148ca3b23ac1bc8c240c2a7dd9c2d7f5"
  }),

  /**
   * @deprecated
   * X:3CRV, etc. aka StableFactory
   */
  META_FACTORY: Address.make({
    [ChainId.ETH_MAINNET]: "0xB9fC157394Af804a3578134A6585C0dc9cc990d4"
  }),

  /**
   * @deprecated
   * tricrypto2, etc.
   */
  CRYPTO_FACTORY: Address.make({
    [ChainId.ETH_MAINNET]: "0x8F942C20D02bEfc377D41445793068908E2250D0"
  }),

  /**
   * @deprecated
   * zap
   */
  CURVE_ZAP: Address.make({
    [ChainId.ETH_MAINNET]: "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
  }),

  /**
   * @deprecated
   * Uniswap V3 Router
   */
  UNISWAP_V3_ROUTER: Address.make({
    [ChainId.ETH_MAINNET]: "0xE592427A0AEce92De3Edee1F18E0157C05861564"
  }),

  /**
   * @deprecated
   * Uniswap V3 Quoter V2
   */
  UNISWAP_V3_QUOTER_V2: Address.make({
    [ChainId.ETH_MAINNET]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
  }),

  /**
   * @deprecated
   */
  BEAN_ETH_UNIV2_LP: Address.make({
    [ChainId.ETH_MAINNET]: "0x87898263B6C5BABe34b4ec53F22d98430b91e371"
  }),

  /**
   * @deprecated
   */
  BEAN_LUSD_LP: Address.make({
    [ChainId.ETH_MAINNET]: "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D"
  }),

  /**
   * @deprecated
   */
  BEAN_CRV3_V1_LP: Address.make({
    [ChainId.ETH_MAINNET]: "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD"
  })
};
