import {
  createClient as createWagmiClient,
  configureChains,
  Chain,
} from 'wagmi';
// import { alchemyProvider } from 'wagmi/providers/alchemy';
// import { publicProvider } from 'wagmi/providers/public';
import { providers } from 'ethers';
import { mainnet, localhost } from 'wagmi/chains';

import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { TESTNET_RPC_ADDRESSES, SupportedChainId } from '~/constants';

// ------------------------------------------------------------
const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
if (!ALCHEMY_KEY) throw new Error('VITE_ALCHEMY_API_KEY is not set');

export type JsonRpcBatchProviderConfig = Omit<
  providers.FallbackProviderConfig,
  'provider'
> & {
  pollingInterval?: number;
  rpc: (chain: Chain) => { http: string; webSocket?: string } | null;
};

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
          default: { http: [rpcConfig.http] },
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
            _chain.id
          ),
      }),
    };
  };
}

/**
 * Create a new wagmi chain instance for a custom testnet.
 */
const makeTestnet = (_chainId: number, name: string): Chain => ({
  id: _chainId,
  name: name,
  network: 'ethereum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [TESTNET_RPC_ADDRESSES[_chainId]] },
    public: { http: [TESTNET_RPC_ADDRESSES[_chainId]] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: true,
});

// ------------------------------------------------------------

const baseChains: Chain[] = [mainnet];
if (import.meta.env.VITE_SHOW_DEV_CHAINS) {
  baseChains.push(makeTestnet(SupportedChainId.TESTNET, 'Testnet'));
  baseChains.push(makeTestnet(SupportedChainId.ANVIL1, 'Basin Testnet'));
  baseChains.push(localhost);
}

const { chains, provider } = configureChains(baseChains, [
  // This is to be removed. We are using the batch provider below for everything
  // and giving it the Alchemy url manually. Leaving this here for now in case we need to revert
  // alchemyProvider({
  //   apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
  //   priority: 0,
  // }),

  // This will batch all read operations that happen in the same event loop
  jsonRpcBatchProvider({
    priority: 1,
    rpc: (_chain) => {
      // if we're on mainnet, use the alchemy RPC
      if (_chain.id === SupportedChainId.MAINNET)
        return { http: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}` };

      // if we're on a testnet or dev, lookup what rpc to use
      if (!TESTNET_RPC_ADDRESSES[_chain.id]) {
        console.error('No RPC address for chain', _chain.id);
        return null;
      }
      return { http: TESTNET_RPC_ADDRESSES[_chain.id] };
    },
  }),
  // Commented out (temporarily?) as it appears to not be able to handle
  // the amount of requests the UI needs to work
  // publicProvider({
  //   priority: 2,
  // }),
]);

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!WALLETCONNECT_PROJECT_ID) {
  console.warn('WalletConnect project ID not set');
}

const client = createWagmiClient({
  autoConnect: true,
  provider,
  connectors: [
    new MetaMaskConnector({
      chains,
    }),
    new InjectedConnector({
      chains,
      options: {
        // name: 'Injected',
        shimDisconnect: true,
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: WALLETCONNECT_PROJECT_ID,
        showQrModal: true,
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'Beanstalk',
      },
    }),
  ],
});

export default client;
