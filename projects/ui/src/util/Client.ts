import { createClient as createWagmiClient, configureChains, chain, Chain } from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
import { providers } from 'ethers';
// import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { TESTNET_RPC_ADDRESSES, SupportedChainId } from '~/constants';

// ------------------------------------------------------------

export type JsonRpcBatchProviderConfig = Omit<providers.FallbackProviderConfig, 'provider'> & {
  pollingInterval?: number
  rpc: (chain: Chain) => { http: string; webSocket?: string } | null
}

/**
 * Wrapper around ethers JsonRpcBatchProvider to enable
 * batch behavior within wagmi.
 */
export function jsonRpcBatchProvider({
  pollingInterval,
  rpc,
  priority,
  stallTimeout,
  weight,
}: JsonRpcBatchProviderConfig) {
  return (_chain: Chain) => {
    const rpcConfig = rpc(_chain);
    if (!rpcConfig || rpcConfig.http === '') return null;
    return {
      chain: {
        ..._chain,
        rpcUrls: {
          ..._chain.rpcUrls,
          default: rpcConfig.http,
        },
      },
      provider: () => {
        const RpcProvider = providers.JsonRpcBatchProvider;
        const provider = new RpcProvider(rpcConfig.http, {
          chainId: _chain.id,
          name: _chain.network,
        });
        if (pollingInterval) provider.pollingInterval = pollingInterval;
        return Object.assign(provider, { priority, stallTimeout, weight });
      },
      ...(rpcConfig.webSocket && {
        webSocketProvider: () =>
          new providers.WebSocketProvider(
            rpcConfig.webSocket as string,
            _chain.id,
          ),
      }),
    };
  };
}

/**
 * Create a new wagmi chain instance for a custom testnet.
 */
const makeTestnet = (_chainId: number, name: string) : Chain => ({
  id: _chainId,
  name: name,
  network: 'ethereum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: TESTNET_RPC_ADDRESSES[_chainId],
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: true,
});

// ------------------------------------------------------------

const baseChains = [chain.mainnet];
if (import.meta.env.VITE_SHOW_DEV_CHAINS) {
  baseChains.push(makeTestnet(SupportedChainId.CUJO, 'Cujo'));
  baseChains.push(chain.localhost);
}

const { chains, provider } = configureChains(
  baseChains, 
  [
    alchemyProvider({
      apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
      priority: 0,
    }),
    /// On known networks (homestead, goerli, etc.) Alchemy will
    /// be used by default. In other cases, we fallback to a
    /// provided RPC address for the given testnet chain.
    jsonRpcBatchProvider({
      priority: 1,
      rpc: (_chain) => {
        if (!TESTNET_RPC_ADDRESSES[_chain.id]) return null;
        return { http: TESTNET_RPC_ADDRESSES[_chain.id] };
      },
    }),
    publicProvider({
      priority: 2,
    }),
  ]
);

const client = createWagmiClient({
  autoConnect: true,
  provider,
  connectors: [
    new MetaMaskConnector({
      chains
    }),
    new InjectedConnector({
      chains,
      options: {
        // name: 'Injected',
        shimDisconnect: true,
      }
    }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: true,
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'Beanstalk',
      }
    }),
  ]
});

export default client;
