import { http, createConfig } from 'wagmi';
import { injected, safe, walletConnect } from 'wagmi/connectors';
import { Chain, type Transport } from 'viem';
import {
  mainnet,
  arbitrum,
  localForkArbitrum,
  localForkMainnet,
  ARBITRUM_RPC,
  MAINNET_RPC,
} from './chains';

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!ALCHEMY_KEY) {
  throw new Error('VITE_ALCHEMY_API_KEY is not set');
}
if (!WALLET_CONNECT_PROJECT_ID) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is not set');
}

const SHOW_DEV = import.meta.env.VITE_SHOW_DEV_CHAINS;

const prodChains: readonly [Chain, ...Chain[]] = [mainnet, arbitrum] as const;
const preBS3DevChains: readonly [Chain, ...Chain[]] = [
  mainnet,
  localForkMainnet,
  localForkArbitrum,
] as const;

const postBS3DevChains: readonly [Chain, ...Chain[]] = [
  mainnet,
  localForkMainnet,
  localForkArbitrum,
  arbitrum,
] as const;

const devChains = import.meta.env.VITE_BS3_DEPLOYED
  ? postBS3DevChains
  : preBS3DevChains;

const chains: readonly [Chain, ...Chain[]] = !SHOW_DEV ? prodChains : devChains;

const transports: Record<number, Transport> = !SHOW_DEV
  ? {
      [mainnet.id]: http(MAINNET_RPC),
      [arbitrum.id]: http(ARBITRUM_RPC),
    }
  : {
      [mainnet.id]: http(MAINNET_RPC),
      [localForkMainnet.id]: http(localForkMainnet.rpcUrls.default.http[0]),
      [localForkArbitrum.id]: http(localForkArbitrum.rpcUrls.default.http[0]),
      [arbitrum.id]: http(ARBITRUM_RPC),
    };

export const config = createConfig({
  chains,
  transports,
  connectors: [
    injected(),
    walletConnect({
      projectId: WALLET_CONNECT_PROJECT_ID,
    }),
    safe(),
  ],
});

export const client = config.getClient();
