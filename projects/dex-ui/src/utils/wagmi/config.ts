import { http, createConfig } from "wagmi";

import { localFork, anvil1, localForkMainnet, mainnet, arbitrum } from "./chains";
import { Settings } from "src/settings";
import { getDefaultConfig } from "connectkit";
import { RPC_URLS } from "./urls";
import { Chain, Transport } from "viem";

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const chains: readonly [Chain, ...Chain[]] = Settings.PRODUCTION
  ? [mainnet, arbitrum]
  : [localFork, localForkMainnet, anvil1, mainnet, arbitrum];

const transports: Record<number, Transport> = Settings.PRODUCTION
  ? {
      [mainnet.id]: http(RPC_URLS.mainnet),
      [arbitrum.id]: http(RPC_URLS.arbitrum)
    }
  : {
      [localFork.id]: http(localFork.rpcUrls.default.http[0]),
      [localForkMainnet.id]: http(localForkMainnet.rpcUrls.default.http[0]),
      [anvil1.id]: http(anvil1.rpcUrls.default.http[0]),
      [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
      [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0])
    };

const configObject = {
  chains,

  transports,

  // Required App Info
  appName: "Basin",

  // Optional App Info
  appDescription: "A Composable EVM-Native DEX",
  appUrl: "https://basin.exchange", // your app's url
  appIcon: "https://basin.exchange/favicon.svg", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  walletConnectProjectId: WALLET_CONNECT_PROJECT_ID
};

if (!WALLET_CONNECT_PROJECT_ID) {
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is not set");
}

// Add wallet connect if we have a project id env var

// Create the config object
export const config = createConfig(getDefaultConfig(configObject));
