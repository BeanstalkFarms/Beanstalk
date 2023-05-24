import { Settings } from "src/settings";
import { Chain, configureChains, createClient, mainnet } from "wagmi";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { InjectedConnector } from "wagmi/connectors/injected";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";

// import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";

export const localFork: Chain = {
  id: 1337,
  name: "localhost:8545",
  network: "localhost",
  nativeCurrency: {
    decimals: 18,
    name: "localhost",
    symbol: "ETH"
  },
  rpcUrls: {
    public: { http: ["http://localhost:8545"] },
    default: { http: ["http://localhost:8545"] }
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" }
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 11_907_934
    }
  }
};

export const anvil1: Chain = {
  id: 1007,
  name: "anvil1.bean.money",
  network: "anvil",
  nativeCurrency: {
    decimals: 18,
    name: "localhost",
    symbol: "ETH"
  },
  rpcUrls: {
    public: { http: ["http://anvil1.bean.money:8545"] },
    default: { http: ["http://anvil1.bean.money:8545"] }
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" }
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 11_907_934
    }
  }
};

const networks = Settings.PRODUCTION ? [mainnet] : [localFork, anvil1, mainnet];

const { chains, provider } = configureChains(networks, [
  alchemyProvider({
    apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
    priority: 0
  }),
  publicProvider({ priority: 2 })
]);

// any - hack to suppress weird ts error
export const client: any = createClient({
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
        shimDisconnect: true
      }
    }),
    // new WalletConnectConnector({
    //   chains,
    //   options: {
    //     projectId: "TODO",
    //     showQrModal: true
    //   }
    // }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: "Beanstalk DEX"
      }
    })
  ]
});
