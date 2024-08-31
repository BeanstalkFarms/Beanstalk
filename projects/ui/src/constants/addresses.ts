import { Address } from '@beanstalk/sdk-core';
import { SupportedChainId } from './chains';

// ----------------------------------------
// Beanstalk Contracts
// ----------------------------------------

export const BEANSTALK_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70'.toLowerCase(),
};

export const BEANSTALK_PRICE_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x4bed6cb142b7d474242d87f4796387deb9e1e1b4'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xEfE94bE746681ed73DfD15F932f9a8e8ffDdEE56'.toLowerCase(),
};

export const BEANSTALK_FERTILIZER_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x402c84De2Ce49aF88f5e2eF3710ff89bFED36cB6'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x82a17bdeC3368f549A7BfE6734D6E2Aba82be455'.toLowerCase(),
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
  [SupportedChainId.ARBITRUM]:
    '0xBEA0005B8599265D41256905A9B3073D397812E4'.toLowerCase(),
};

export const UNRIPE_BEAN_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe Bean": Unripe vesting asset for the Bean token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]:
    '0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x1BEA054dddBca12889e07B3E076f511Bf1d27543'.toLowerCase(),
};

export const UNRIPE_BEAN_WSTETH_ADDRESSES = {
  // --------------------------------------------------
  // "Unripe BEAN:WETH LP": Unripe vesting asset for the BEAN:WETH LP token, Localhost
  // -------------------------------------------------
  [SupportedChainId.MAINNET]:
    '0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788'.toLowerCase(),
};

// ----------------------------------------
// Common ERC-20 Tokens
// ----------------------------------------
export const WETH_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'.toLowerCase(),
};

export const WSTETH_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x5979D7b546E38E414F7E9822514be443A4800529'.toLowerCase(),
};

export const WEETH_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe'.toLowerCase(),
};

export const WBTC_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'.toLowerCase(),
};

export const DAI_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'.toLowerCase(),
};

export const USDC_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'.toLowerCase(),
};

export const USDT_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'.toLowerCase(),
};

export const CRV3_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'.toLowerCase(),
};

export const LUSD_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0'.toLowerCase(),
};

export const ARB_ADDRESSES = {
  // bridged
  [SupportedChainId.MAINNET]:
    '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x912CE59144191C1204E64559FE8253a0e49E6548'.toLowerCase(),
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
  [SupportedChainId.ARBITRUM]:
    '0xBEA00ebA46820994d24E45dffc5c006bBE35FD89'.toLowerCase(),
};

export const BEAN_WSTETH_ADDRESSS = {
  [SupportedChainId.MAINNET]:
    '0xBeA0000113B0d182f4064C86B71c315389E4715D'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xBEA0039bC614D95B65AB843C4482a1A5D2214396'.toLowerCase(),
};

export const BEANWEETH_WELL_ADDRESSES = {
  [SupportedChainId.ARBITRUM]:
    '0xBEA000B7fde483F4660041158D3CA53442aD393c'.toLowerCase(),
};

export const BEANWBTC_WELL_ADDRESSES = {
  [SupportedChainId.ARBITRUM]:
    '0xBEA0078b587E8f5a829E171be4A74B6bA1565e6A'.toLowerCase(),
};

export const BEANUSDC_WELL_ADDRESSES = {
  [SupportedChainId.ARBITRUM]:
    '0xBEA00C30023E873D881da4363C00F600f5e14c12'.toLowerCase(),
};

export const BEANUSDT_WELL_ADDRESSES = {
  [SupportedChainId.ARBITRUM]:
    '0xBEA00699562C71C2d3fFc589a848353151a71A61'.toLowerCase(),
};

export const BEAN_LUSD_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D'.toLowerCase(),
};

export const BEAN_ETH_UNIV2_LP_ADDRESSES = {
  [SupportedChainId.MAINNET]:
    '0x87898263B6C5BABe34b4ec53F22d98430b91e371'.toLowerCase(),
};

export const DAI_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]:
    '0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB'.toLowerCase(),
});

export const USDT_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]:
    '0x3e7d1eab13ad0104d2750b8863b489d65364e32d'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7'.toLowerCase(),
});

export const USDC_CHAINLINK_ADDRESSES = Address.make({
  [SupportedChainId.MAINNET]:
    '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6'.toLowerCase(),
  [SupportedChainId.ARBITRUM]:
    '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3'.toLowerCase(),
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
