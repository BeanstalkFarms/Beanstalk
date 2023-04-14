import ethereumLogoUrl from '~/img/tokens/eth-logo.svg';
import {
  L1ChainInfo,
  L2ChainInfo,
  NetworkType,
  SupportedChainId,
  SupportedL1ChainId,
  SupportedL2ChainId
} from '~/constants/chains';

export type ChainInfoMap = { readonly [chainId: number]: L1ChainInfo | L2ChainInfo } 
& { readonly [chainId in SupportedL1ChainId]: L1ChainInfo }
& { readonly [chainId in SupportedL2ChainId]: L2ChainInfo }

/**
 * FIXME: this was forked from Uniswap's UI but we only use `explorer` here.
 */
 export const CHAIN_INFO : ChainInfoMap = {
  [SupportedChainId.MAINNET]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    label: 'Ethereum',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  [SupportedChainId.LOCALHOST]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    label: 'Localhost',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Localhost Ether', symbol: 'locETH', decimals: 18 },
  },
  [SupportedChainId.CUJO]: {
    networkType: NetworkType.L1,
    explorer: 'https://etherscan.io',
    label: 'Harhat',
    logoUrl: ethereumLogoUrl,
    nativeCurrency: { name: 'Hardhat Ether', symbol: 'hETH', decimals: 18 },
  }
};
