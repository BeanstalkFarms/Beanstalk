import { Alchemy, Network } from "alchemy-sdk";

export const alchemy = new Alchemy({
  apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET
});
