import { SupportedChainId } from './chains';

// ----------------------------------------
// Beanstalk Contracts
// ----------------------------------------

export const BEANSTALK_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'.toLowerCase(),
};

export const BEANSTALK_PRICE_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xF2C2b7eabcB353bF6f2128a7f8e1e32Eeb112530'.toLowerCase(),
};

export const BEANSTALK_FERTILIZER_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6'.toLowerCase(),
};

export const BARNRAISE_CUSTODIAN_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xa9bA2C40b263843C04d344727b954A545c81D043'.toLowerCase(),
};

// ----------------------------------------
// BeaNFT Contracts
// ----------------------------------------

export const BEANFT_GENESIS_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79'.toLowerCase(),
};

export const BEANFT_WINTER_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x459895483556daD32526eFa461F75E33E458d9E9'.toLowerCase(),
};

// ----------------------------------------
// Bean & Unripe Bean Tokens
// ----------------------------------------

export const BEAN_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab'.toLowerCase(),
};

export const UNRIPE_BEAN_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe Bean": Unripe vesting asset for the Bean token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]: '0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449'.toLowerCase(),
};

export const UNRIPE_BEAN_CRV3_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe BEAN:CRV3 LP": Unripe vesting asset for the BEAN:CRV3 LP token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]: '0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D'.toLowerCase(),
};

// ----------------------------------------
// Common ERC-20 Tokens
// ----------------------------------------

export const DAI_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(),
};

export const USDC_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
};

export const USDT_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
};

export const CRV3_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'.toLowerCase(),
};

export const LUSD_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0'.toLowerCase(),
};

// ----------------------------------------
// Curve Pools: BEAN
// ----------------------------------------

export const BEAN_CRV3_ADDRESSES = {
  // --------------------------------------------------
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
  [SupportedChainId.MAINNET]: '0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49'.toLowerCase(),
};

// ----------------------------------------
// Curve Pools: Other
// ----------------------------------------

export const POOL3_ADDRESSES = {
  // --------------------------------------------------
  // "Curve.fi: DAI/USDC/USDT Pool" (aka 3pool)
  // --------------------------------------------------
  // coins[0] = 0x6B175474E89094C44Da98b954EedeAC495271d0F (DAI)
  // coins[1] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
  // coins[2] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
  [SupportedChainId.MAINNET]: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'.toLowerCase(),
};

export const TRICRYPTO2_ADDRESSES = {
  // --------------------------------------------------
  // tricrypto2
  // --------------------------------------------------
  // coins[0] = 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
  // coins[1] = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 (WBTC)
  // coins[2] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)
  [SupportedChainId.MAINNET]: '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46'.toLowerCase(),
};

// ----------------------------------------
// Curve: Registries / Factories / Utils
// ----------------------------------------
// "metapool" and "cryptoswap" are simultaneously
// - "registries" (they track a list of pools)
// - "factories"  (they allow creation of new pools)

// 3pool, etc.
export const POOL_REGISTRY_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x90e00ace148ca3b23ac1bc8c240c2a7dd9c2d7f5'.toLowerCase()
};

// X:3CRV, etc. aka StableFactory
export const META_FACTORY_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'.toLowerCase()
};

// tricrypto2, etc.
export const CRYPTO_FACTORY_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x8F942C20D02bEfc377D41445793068908E2250D0'.toLowerCase()
};

// zap
export const CURVE_ZAP_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xA79828DF1850E8a3A3064576f380D90aECDD3359'.toLowerCase()
};

export const DAI_CHAINLINK_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9'.toLowerCase()
};

export const USDT_CHAINLINK_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x3e7d1eab13ad0104d2750b8863b489d65364e32d'.toLowerCase()
};

export const USDC_CHAINLINK_ADDRESSES = {
  [SupportedChainId.MAINNET]: '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6'.toLowerCase()
};

export const ETH_CHAINLINK_ADDRESS = {
  [SupportedChainId.MAINNET]: '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419'.toLowerCase(),
};
