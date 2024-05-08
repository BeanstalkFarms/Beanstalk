import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { localFork, anvil1 } from "./chains";
import { Settings } from "src/settings";
import { getDefaultConfig } from "connectkit";

const MAINNET_RPC = `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`;

const chains = Settings.PRODUCTION ? [mainnet] : [localFork, anvil1, mainnet];
const transports = Settings.PRODUCTION
  ? { [mainnet.id]: http(MAINNET_RPC) }
  : {
      [localFork.id]: http(localFork.rpcUrls.default.http[0]),
      [anvil1.id]: http(anvil1.rpcUrls.default.http[0]),
      [mainnet.id]: http(MAINNET_RPC)
    };

const configObject: any = {
  // @ts-ignore
  chains,
  // @ts-ignore
  transports,

  // Required App Info
  appName: "Basin",

  // Optional App Info
  appDescription: "A Composable EVM-Native DEX",
  appUrl: "https://basin.exchange", // your app's url
  appIcon: "https://basin.exchange/favicon.svg" // your app's icon, no bigger than 1024x1024px (max. 1MB)
};

// Add wallet connect if we have a project id env var
const walletConnectProjectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
if (walletConnectProjectId) {
  configObject.walletConnectProjectId = walletConnectProjectId;
}

// Create the config object
export const config = createConfig(getDefaultConfig(configObject));
