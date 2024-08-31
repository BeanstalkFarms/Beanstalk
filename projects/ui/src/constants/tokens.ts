// Ethereum Images
import ethIconCircledUrl from '~/img/tokens/eth-logo-circled.svg';
import wEthIconCircledUrl from '~/img/tokens/weth-logo-circled.svg';

// Bean Images
// import beanLogoUrl from '~/img/tokens/bean-logo.svg';
import beanCircleLogoUrl from '~/img/tokens/bean-logo-circled.svg';
import beanCrv3LpLogoUrl from '~/img/tokens/bean-crv3-logo.svg';
import beanWstethLogo from '~/img/tokens/bean-wsteth-logo.svg';

// Beanstalk Token Logos
import stalkLogo from '~/img/beanstalk/stalk-icon-winter.svg';
import seedLogo from '~/img/beanstalk/seed-icon-winter.svg';
import podsLogo from '~/img/beanstalk/pod-icon-winter.svg';
import sproutLogo from '~/img/beanstalk/sprout-icon-winter.svg';
import rinsableSproutLogo from '~/img/beanstalk/rinsable-sprout-icon.svg';
import beanEthLpLogoUrl from '~/img/tokens/bean-eth-lp-logo.svg';
import beanEthWellLpLogoUrl from '~/img/tokens/bean-eth-well-lp-logo.svg';
import beanLusdLogoUrl from '~/img/tokens/bean-lusd-logo.svg';

// ERC-20 Token Images
import wstethLogo from '~/img/tokens/wsteth-logo.svg';
import crv3LogoUrl from '~/img/tokens/crv3-logo.png';
import daiLogoUrl from '~/img/tokens/dai-logo.svg';
import usdcLogoUrl from '~/img/tokens/usdc-logo.svg';
import usdtLogoUrl from '~/img/tokens/usdt-logo.svg';
import lusdLogoUrl from '~/img/tokens/lusd-logo.svg';
import wbtcLogoUrl from '~/img/tokens/wbtc-logo.svg';
import weethIcon from '~/img/tokens/weeth-logo.png';
import unripeBeanLogoUrl from '~/img/tokens/unripe-bean-logo-circled.svg';
import unripeBeanWstethLogoUrl from '~/img/tokens/unripe-bean-wsteth-logo.svg';

// Other imports
import { BeanstalkPalette } from '~/components/App/muiTheme';
import {
  ERC20Token,
  NativeToken,
  BeanstalkToken,
  LegacyTokenMetadata,
  LegacyTokenRewards,
} from '~/classes/Token';
import { SupportedChainId } from './chains';
import { ChainConstant } from '.';
import {
  BEAN_CRV3_ADDRESSES,
  CRV3_ADDRESSES,
  DAI_ADDRESSES,
  LUSD_ADDRESSES,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  UNRIPE_BEAN_ADDRESSES,
  UNRIPE_BEAN_WSTETH_ADDRESSES,
  BEAN_ADDRESSES,
  BEAN_ETH_WELL_ADDRESSES,
  BEAN_CRV3_V1_ADDRESSES,
  BEAN_WSTETH_ADDRESSS,
  WSTETH_ADDRESSES,
  WETH_ADDRESSES,
  WEETH_ADDRESSES,
  WBTC_ADDRESSES,
  BEANWEETH_WELL_ADDRESSES,
  BEANWBTC_WELL_ADDRESSES,
  BEANUSDC_WELL_ADDRESSES,
  BEANUSDT_WELL_ADDRESSES,
} from './addresses';

// ----------------------------------------
// Types + Utilities
// ----------------------------------------

const CHAIN_IDS = [
  SupportedChainId.MAINNET,
  SupportedChainId.ARBITRUM,
] as const;

const makeChainToken = (
  addresses: ChainConstant<string>,
  decimals: number,
  meta: LegacyTokenMetadata,
  rewards?: LegacyTokenRewards
) => {
  const tokensByChainId = CHAIN_IDS.reduce<ChainConstant<ERC20Token>>(
    (prev, chainId) => {
      if (addresses[chainId]) {
        prev[chainId] = new ERC20Token(
          chainId,
          addresses,
          decimals,
          meta,
          rewards
        );
      }

      return prev;
    },
    {}
  );

  return tokensByChainId;
};

// ----------------------------------------
// Native Tokens
// ----------------------------------------

export const ETH_DECIMALS = 18;
export const ETH = {
  [SupportedChainId.MAINNET]: new NativeToken(
    SupportedChainId.MAINNET,
    'ETH',
    ETH_DECIMALS,
    {
      name: 'Ether',
      symbol: 'ETH',
      logo: ethIconCircledUrl,
      displayDecimals: 4,
    }
  ),
  [SupportedChainId.ARBITRUM]: new NativeToken(
    SupportedChainId.ARBITRUM,
    'ETH',
    ETH_DECIMALS,
    {
      name: 'Ether',
      symbol: 'ETH',
      logo: ethIconCircledUrl,
      displayDecimals: 4,
    }
  ),
};

// ----------------------------------------
// Beanstalk Internal Tokens (not ERC20)
//
// We don't need to make these tokens chain specific.
// ----------------------------------------
export const STALK = new BeanstalkToken(SupportedChainId.ARBITRUM, '', 16, {
  name: 'Stalk',
  symbol: 'STALK',
  logo: stalkLogo,
});

export const SEEDS = new BeanstalkToken(SupportedChainId.ARBITRUM, '', 6, {
  name: 'Seeds',
  symbol: 'SEED',
  logo: seedLogo,
});

export const PODS = new BeanstalkToken(SupportedChainId.ARBITRUM, '', 6, {
  name: 'Pods',
  symbol: 'PODS',
  logo: podsLogo,
});

export const SPROUTS = new BeanstalkToken(SupportedChainId.ARBITRUM, '', 6, {
  name: 'Sprouts',
  symbol: 'SPROUT',
  logo: sproutLogo,
});

export const RINSABLE_SPROUTS = new BeanstalkToken(
  SupportedChainId.ARBITRUM,
  '',
  6,
  {
    name: 'Rinsable Sprouts',
    symbol: 'rSPROUT',
    logo: rinsableSproutLogo,
  }
);

// ----------------------------------------
// ERC20 Tokens
// ----------------------------------------

const defaultRewards: LegacyTokenRewards = {
  stalk: 1,
  seeds: 0,
} as const;

export const BEAN = makeChainToken(
  BEAN_ADDRESSES,
  6,
  {
    name: 'Bean',
    symbol: 'BEAN',
    logo: beanCircleLogoUrl,
    color: BeanstalkPalette.logoGreen,
  },
  { ...defaultRewards }
);

export const WETH = makeChainToken(WETH_ADDRESSES, 18, {
  name: 'Wrapped Ether',
  symbol: 'WETH',
  logo: wEthIconCircledUrl,
  displayDecimals: 4,
});

export const WSTETH = makeChainToken(WSTETH_ADDRESSES, 18, {
  name: 'Wrapped liquid staked Ether 2.0',
  symbol: 'wstETH',
  logo: wstethLogo,
});

export const WEETH = makeChainToken(WEETH_ADDRESSES, 18, {
  name: 'Wrapped Ether',
  symbol: 'WEETH',
  logo: weethIcon,
});

export const WBTC = makeChainToken(WBTC_ADDRESSES, 18, {
  name: 'Wrapped Bitcoin',
  symbol: 'WBTC',
  logo: wbtcLogoUrl,
});

export const DAI = makeChainToken(DAI_ADDRESSES, 18, {
  name: 'Dai',
  symbol: 'DAI',
  logo: daiLogoUrl,
});

export const USDC = makeChainToken(USDC_ADDRESSES, 6, {
  name: 'USD Coin',
  symbol: 'USDC',
  logo: usdcLogoUrl,
});

export const USDT = makeChainToken(USDT_ADDRESSES, 6, {
  name: 'Tether',
  symbol: 'USDT',
  logo: usdtLogoUrl,
});

// ----------------------------------------
// ERC20 Tokens - LP
// ----------------------------------------

export const BEAN_ETH_WELL_LP = makeChainToken(
  BEAN_ETH_WELL_ADDRESSES,
  18,
  {
    name: 'BEAN:ETH LP',
    symbol: 'BEANETH',
    logo: beanEthWellLpLogoUrl,
    isLP: true,
    color: '#DFB385',
  },
  { ...defaultRewards }
);

export const BEAN_WSTETH_WELL_LP = makeChainToken(
  BEAN_WSTETH_ADDRESSS,
  18,
  {
    name: 'BEAN:wstETH LP',
    symbol: 'BEANwstETH',
    logo: beanWstethLogo,
    displayDecimals: 2,
    color: BeanstalkPalette.lightBlue,
    isUnripe: false,
  },
  { ...defaultRewards }
);

export const BEAN_WEETH_WELL_LP = makeChainToken(
  BEANWEETH_WELL_ADDRESSES,
  18,
  {
    name: 'BEAN:weETH LP',
    symbol: 'BEANweETH',
    isLP: true,
    logo: beanWstethLogo, // TODO: replace with bean:weeth logo
    isUnripe: false,
    displayDecimals: 2,
  },
  { ...defaultRewards }
);

export const BEAN_WBTC_WELL_LP = makeChainToken(
  BEANWBTC_WELL_ADDRESSES,
  18,
  {
    name: 'BEAN:WBTC LP',
    symbol: 'BEANWBTC',
    isLP: true,
    isUnripe: false,
    logo: beanWstethLogo, // TODO: replace with bean:weeth logo
    displayDecimals: 2,
  },
  { ...defaultRewards }
);

export const BEAN_USDC_WELL_LP = makeChainToken(
  BEANUSDC_WELL_ADDRESSES,
  18,
  {
    name: 'BEAN:USDC LP',
    symbol: 'BEANUSDC',
    isLP: true,
    isUnripe: false,
    logo: beanWstethLogo, // TODO: replace with bean:weeth logo
    displayDecimals: 2,
  },
  { ...defaultRewards }
);

export const BEAN_USDT_WELL_LP = makeChainToken(
  BEANUSDT_WELL_ADDRESSES,
  18,
  {
    name: 'BEAN:USDT LP',
    symbol: 'BEANUSDT',
    isLP: true,
    isUnripe: false,
    logo: beanWstethLogo, // TODO: replace with bean:weeth logo
    displayDecimals: 2,
  },
  { ...defaultRewards }
);

// ----------------------------------------
// ERC20 Tokens - Unripe
// ----------------------------------------

export const UNRIPE_BEAN = makeChainToken(
  UNRIPE_BEAN_ADDRESSES,
  6,
  {
    name: 'Unripe Bean',
    symbol: 'urBEAN',
    logo: unripeBeanLogoUrl,
    displayDecimals: 2,
    color: '#ECBCB3',
    isUnripe: true,
  },
  { ...defaultRewards }
);

export const UNRIPE_BEAN_WSTETH = makeChainToken(
  UNRIPE_BEAN_WSTETH_ADDRESSES,
  6,
  {
    name: 'Unripe BEAN:wstETH LP',
    symbol: 'urBEANwstETH',
    logo: unripeBeanWstethLogoUrl,
    displayDecimals: 2,
    color: BeanstalkPalette.lightBlue,
    isUnripe: true,
  },
  { ...defaultRewards }
);

// ----------------------------------------
// Token Lists
// ----------------------------------------

export const UNRIPE_TOKENS: ChainConstant<ERC20Token>[] = [
  UNRIPE_BEAN,
  UNRIPE_BEAN_WSTETH,
];
export const UNRIPE_UNDERLYING_TOKENS: ChainConstant<ERC20Token>[] = [
  BEAN,
  WSTETH,
];

// Show these tokens as whitelisted in the Silo.
export const SILO_WHITELIST: ChainConstant<ERC20Token>[] = [
  BEAN,
  BEAN_WSTETH_WELL_LP,
  BEAN_ETH_WELL_LP,
  BEAN_WEETH_WELL_LP,
  BEAN_WBTC_WELL_LP,
  BEAN_USDC_WELL_LP,
  BEAN_USDT_WELL_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WSTETH,
];

// All supported ERC20 tokens.
export const ERC20_TOKENS: ChainConstant<ERC20Token>[] = [
  // Whitelisted Silo tokens
  ...SILO_WHITELIST,
  // Commonly-used tokens
  WETH,
  WEETH,
  WBTC,
  DAI,
  USDC,
  USDT,
  WSTETH,
];

// ----------------------------------------
// LEGACY TOKENS
//
// Keep for reference & for legacy support.
// ----------------------------------------

/** @deprecated */
export const LUSD = makeChainToken(LUSD_ADDRESSES, 18, {
  name: 'LUSD',
  symbol: 'LUSD',
  logo: lusdLogoUrl,
});

/** @deprecated */
export const CRV3 = makeChainToken(CRV3_ADDRESSES, 18, {
  name: '3CRV',
  symbol: '3CRV',
  logo: crv3LogoUrl,
  isLP: true,
});

// TEMP
/** @deprecated */
export const BEAN_ETH_UNIV2_LP = makeChainToken(
  '0x87898263B6C5BABe34b4ec53F22d98430b91e371',
  18,
  {
    name: 'BEAN:ETH LP',
    symbol: 'Old BEANETH',
    logo: beanEthLpLogoUrl,
    displayDecimals: 9,
    isLP: true,
  }
);

/** @deprecated */
export const BEAN_LUSD_LP = makeChainToken(
  '0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D',
  18,
  {
    name: 'BEAN:LUSD LP',
    symbol: 'Old BEANLUSD',
    logo: beanLusdLogoUrl,
    isLP: true,
  }
);

/** @deprecated */
export const BEAN_CRV3_LP = makeChainToken(BEAN_CRV3_ADDRESSES, 18, {
  name: 'BEAN:3CRV LP',
  symbol: 'BEAN3CRV',
  logo: beanCrv3LpLogoUrl,
  isLP: true,
  color: '#DFB385',
});

/** @deprecated */
export const BEAN_CRV3_V1_LP = makeChainToken(BEAN_CRV3_V1_ADDRESSES, 6, {
  name: 'BEAN:CRV3 V1 LP',
  symbol: 'Old BEAN3CRV',
  logo: beanCrv3LpLogoUrl,
  isLP: true,
  color: '#DFB385',
});
