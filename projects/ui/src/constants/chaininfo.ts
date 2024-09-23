import ethereumLogoUrl from '~/img/tokens/eth-logo.svg';
import {
  L1ChainInfo,
  L2ChainInfo,
  NetworkType,
  SupportedChainId,
  SupportedL1ChainId,
  SupportedL2ChainId,
} from '~/constants/chains';
import etherscanIcon from '~/img/beanstalk/interface/nav/etherscan.svg';
import arbitrumIcon from '~/img/tokens/arbitrum-logo.svg';

export type ChainInfoMap = {
  readonly [chainId: number]: L1ChainInfo | L2ChainInfo;
} & { readonly [chainId in SupportedL1ChainId]: L1ChainInfo } & {
  readonly [chainId in SupportedL2ChainId]: L2ChainInfo;
};

/**
 * FIXME: this was forked from Uniswap's UI but we only use `explorer` here.
 */
export const CHAIN_INFO: ChainInfoMap = {
  [SupportedChainId.ETH_MAINNET]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    explorerName: 'Etherscan',
    explorerLogoUrl: etherscanIcon,
    label: 'Ethereum',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  [SupportedChainId.LOCALHOST_ETH]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    explorerName: 'Etherscan',
    explorerLogoUrl: etherscanIcon,
    label: 'Localhost',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Localhost Ether', symbol: 'locETH', decimals: 18 },
  },
  [SupportedChainId.ANVIL1]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    explorerName: 'Etherscan',
    explorerLogoUrl: etherscanIcon,
    label: 'Basin Integration Test',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Basin Test Ether', symbol: 'btETH', decimals: 18 },
  },
  [SupportedChainId.TESTNET]: {
    networkType: NetworkType.L2,
    explorer: 'https://arbiscan.io',
    explorerName: 'Arbiscan',
    explorerLogoUrl: arbitrumIcon,
    label: 'Arbitrum Testnet',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Tenderly Ether', symbol: 'tETH', decimals: 18 },
    statusPage: 'https://status.arbitrum.io/',
    bridge: 'https://bridge.arbitrum.io',
  },
  [SupportedChainId.ARBITRUM_MAINNET]: {
    networkType: NetworkType.L2,
    explorer: 'https://arbiscan.io',
    explorerName: 'Arbiscan',
    explorerLogoUrl: arbitrumIcon,
    label: 'Arbitrum',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    statusPage: 'https://status.arbitrum.io/',
    bridge: 'https://bridge.arbitrum.io',
  },
  [SupportedChainId.LOCALHOST]: {
    networkType: NetworkType.L2,
    explorer: 'https://arbiscan.io',
    explorerName: 'Arbiscan',
    explorerLogoUrl: arbitrumIcon,
    label: 'Localhost Arbitrum',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    statusPage: 'https://status.arbitrum.io/',
    bridge: 'https://bridge.arbitrum.io',
  },
};
