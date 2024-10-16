import { SupportedChainId } from './chains';

/**
 * Unofficial testnets require a custom RPC URL.
 * Ropsten, Goerli etc. are supported by Alchemy.
 */
export const TESTNET_RPC_ADDRESSES: { [chainId: number]: string } = {
  [SupportedChainId.LOCALHOST]: 'http://localhost:8545',
  [SupportedChainId.TESTNET]:
    'https://rpc.vnet.tenderly.co/devnet/silo-v3/3ed19e82-a81c-45e5-9b16-5e385aa74587',
  [SupportedChainId.ANVIL1]: 'https://anvil1.bean.money:443',
  [SupportedChainId.LOCALHOST_ETH]: 'http://localhost:9545',
};

// BS3TODO: update me when these are ready
export const BEANSTALK_SUBGRAPH_ADDRESSES: { [chainId: number]: string } = {
  [SupportedChainId.ETH_MAINNET]:
    'https://graph.node.bean.money/subgraphs/name/beanstalk',
  // [SupportedChainId.MAINNET]:   'https://api.thegraph.com/subgraphs/name/cujowolf/beanstalk',
  [SupportedChainId.LOCALHOST]:
    'https://api.thegraph.com/subgraphs/name/cujowolf/beanstalk-dev-replanted',
  [SupportedChainId.TESTNET]:
    'http://graph.playgrounds.academy/subgraphs/name/beanstalk',
};

// BS3TODO: update me when these are ready
/// The BEAN subgraph is slow to index because it tracks many events.
/// To speed up development time, Bean metrics are provided from a separate subgraph.
export const BEAN_SUBGRAPH_ADDRESSES: { [chainId: number]: string } = {
  [SupportedChainId.ETH_MAINNET]:
    'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
  [SupportedChainId.LOCALHOST]:
    'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
  [SupportedChainId.TESTNET]:
    'https://api.thegraph.com/subgraphs/name/cujowolf/bean',
};
