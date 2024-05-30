import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

import { localFork } from './chains';

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!ALCHEMY_KEY) throw new Error('VITE_ALCHEMY_API_KEY is not set');
if (!WALLET_CONNECT_PROJECT_ID)
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is not set');

const MAINNET_RPC = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const SHOW_DEV = import.meta.env.VITE_SHOW_DEV_CHAINS;

const chains = !SHOW_DEV ? [mainnet] : [localFork, mainnet];
const transports = !SHOW_DEV
  ? { [mainnet.id]: http(MAINNET_RPC) }
  : {
      [localFork.id]: http(localFork.rpcUrls.default.http[0]),
      [mainnet.id]: http(MAINNET_RPC),
    };

export const config = createConfig({
  // @ts-ignore
  chains,
  // @ts-ignore
  transports,
  connectors: [
    injected(),
    walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID }),
    // safe(),
  ],
});

export const client = config.getClient();
