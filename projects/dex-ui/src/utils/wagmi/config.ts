import { getDefaultConfig } from "connectkit";
import { Chain, Transport } from "viem";
import { http, createConfig } from "wagmi";

import { ChainId } from "@beanstalk/sdk-core";

import { isPROD } from "src/settings";

import {
  localFork,
  anvil1,
  localForkMainnet,
  ethMainnet,
  arbitrum
  // testnet
} from "./chains";
import { getRpcUrl } from "./urls";

type ChainsConfig = readonly [Chain, ...Chain[]];

type TransportsConfig = Record<number, Transport>;

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!WALLET_CONNECT_PROJECT_ID) {
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is not set");
}

const chains: ChainsConfig = isPROD
  ? [ethMainnet, arbitrum]
  : [localFork, localForkMainnet, anvil1, ethMainnet, arbitrum];

const transports: TransportsConfig = isPROD
  ? {
      [ethMainnet.id]: http(getRpcUrl(ChainId.ETH_MAINNET)),
      [arbitrum.id]: http(getRpcUrl(ChainId.ARBITRUM_MAINNET))
    }
  : {
      [localFork.id]: http(localFork.rpcUrls.default.http[0]),
      [localForkMainnet.id]: http(localForkMainnet.rpcUrls.default.http[0]),
      [anvil1.id]: http(anvil1.rpcUrls.default.http[0]),
      [ethMainnet.id]: http(ethMainnet.rpcUrls.default.http[0]),
      [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0])
      // [testnet.id]: http(testnet.rpcUrls.default.http[0])
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

// Add wallet connect if we have a project id env var

// Create the config object
export const config = createConfig(getDefaultConfig(configObject));
