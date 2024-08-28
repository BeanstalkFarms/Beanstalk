import { Address } from '@beanstalk/sdk-core';
import { SupportedChainId } from './chains';

// ----------------------------------------
// Beanstalk Contracts
// ----------------------------------------

export const BEANSTALK_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'.toLowerCase(),
};

export const BEANSTALK_PRICE_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x4bed6cb142b7d474242d87f4796387deb9e1e1b4'.toLowerCase(),
};

export const BEANSTALK_FERTILIZER_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6'.toLowerCase(),
};

export const BARNRAISE_CUSTODIAN_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xa9bA2C40b263843C04d344727b954A545c81D043'.toLowerCase(),
};

// ----------------------------------------
// BeaNFT Contracts
// ----------------------------------------

export const BEANFT_GENESIS_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xa755A670Aaf1FeCeF2bea56115E65e03F7722A79'.toLowerCase(),
};

export const BEANFT_WINTER_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x459895483556daD32526eFa461F75E33E458d9E9'.toLowerCase(),
};

export const BEANFT_BARNRAISE_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xa969BB19b1d35582Ded7EA869cEcD60A3Bd5D1E8'.toLowerCase(),
};

export const BEANFT_BASIN_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x191b7d1cfa89c9389bbf5f7f49f4b8f93ec3740f'.toLowerCase(),
};

// ----------------------------------------
// Bean & Unripe Bean Tokens
// ----------------------------------------

export const BEAN_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab'.toLowerCase(),
};

export const UNRIPE_BEAN_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe Bean": Unripe vesting asset for the Bean token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]:
    '0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449'.toLowerCase(),
};

export const UNRIPE_BEAN_WSTETH_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe BEAN:WETH LP": Unripe vesting asset for the BEAN:WETH LP token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]:
    '0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D'.toLowerCase(),
};

// ----------------------------------------
// Common ERC-20 Tokens
// ----------------------------------------

export const STETH_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'.toLowerCase(),
};

export const WSTETH_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'.toLowerCase(),
};

export const DAI_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(),
};

export const USDC_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
};

export const USDT_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
};

export const CRV3_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'.toLowerCase(),
};

export const LUSD_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0'.toLowerCase(),
};

// ----------------------------------------
// Curve Pools: BEAN
// ----------------------------------------

export const BEAN_CRV3_ADDRESSES = {
  // --------------------------------------------------
  // "BEAN:3CRV Curve LP Token (BEAN3CRV-f)"
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
  [SupportedChainId.MAINNET]:
    '0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49'.toLowerCase(),
};

export const BEAN_ETH_WELL_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xBEA0e11282e2bB5893bEcE110cF199501e872bAd'.toLowerCase(),
};

export const BEAN_WSTETH_ADDRESSS = {
  [SupportedChainId.MAINNET]:
    '0xBeA0000113B0d182f4064C86B71c315389E4715D'.toLowerCase(),
};

export const DAI_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]: '0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9',
  [SupportedChainId.ARBITRUM]: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB',
});

export const USDT_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]: '0x3e7d1eab13ad0104d2750b8863b489d65364e32d',
  [SupportedChainId.ARBITRUM]: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
});

export const USDC_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]: '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6',
  [SupportedChainId.ARBITRUM]: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
});

export const ETH_CHAINLINK_ADDRESS = {
  [SupportedChainId.MAINNET]:
    '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419'.toLowerCase(),
};

/// Gnosis Snapshot Delegates Registry
export const DELEGATES_REGISTRY_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446'.toLowerCase(),
};

/// Deprecated Pools
export const BEAN_CRV3_V1_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x3a70DfA7d2262988064A2D051dd47521E43c9BdD'.toLowerCase(),
};

/// ENS Reverse Records
export const ENS_REVERSE_RECORDS = {
  [SupportedChainId.MAINNET]:
    '0x3671ae578e63fdf66ad4f3e12cc0c0d71ac7510c'.toLowerCase(),
};

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
