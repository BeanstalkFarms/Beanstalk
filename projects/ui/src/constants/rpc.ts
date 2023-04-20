import { SupportedChainId } from './chains';

/**
 * Unofficial testnets require a custom RPC URL.
 * Ropsten, Goerli etc. are supported by Alchemy.
 */
 export const TESTNET_RPC_ADDRESSES : { [chainId: number] : string } = {
  [SupportedChainId.LOCALHOST]: 'http://localhost:8545',
  [SupportedChainId.CUJO]:      'https://bean-rpc.treetree.finance',
};

export const BEANSTALK_SUBGRAPH_ADDRESSES : { [chainId: number] : string } = {
  [SupportedChainId.MAINNET]:   'https://graph.node.bean.money/subgraphs/name/beanstalk',
  // [SupportedChainId.MAINNET]:   'https://api.thegraph.com/subgraphs/name/cujowolf/beanstalk',
  [SupportedChainId.LOCALHOST]: 'https://api.thegraph.com/subgraphs/name/cujowolf/beanstalk-dev-replanted',
  [SupportedChainId.CUJO]:      'http://graph.playgrounds.academy/subgraphs/name/beanstalk',
};

/// The BEAN subgraph is slow to index because it tracks many events.
/// To speed up development time, Bean metrics are provided from a separate subgraph.
export const BEAN_SUBGRAPH_ADDRESSES : { [chainId: number] : string } = {
  [SupportedChainId.MAINNET]:   'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
  [SupportedChainId.LOCALHOST]: 'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
  [SupportedChainId.CUJO]:      'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
};
