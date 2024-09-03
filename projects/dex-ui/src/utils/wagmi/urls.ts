const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;

if (!apiKey) {
  throw new Error("VITE_ALCHEMY_API_KEY is not set");
}

const MAINNET_RPC = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;

const ARBITRUM_RPC = `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`;

export const RPC_URLS = {
  mainnet: MAINNET_RPC,
  arbitrum: ARBITRUM_RPC
};
