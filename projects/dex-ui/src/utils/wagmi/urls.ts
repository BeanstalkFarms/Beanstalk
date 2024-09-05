import { ChainId } from "@beanstalk/sdk-core";

const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;

if (!apiKey) {
  throw new Error("VITE_ALCHEMY_API_KEY is not set");
}

const RPC_URLS: Record<number, string> = {
  [ChainId.MAINNET]: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
  [ChainId.ARBITRUM]: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
  [ChainId.LOCALHOST]: "http://localhost:8545",
  [ChainId.LOCALHOST_MAINNET]: "http://localhost:9545",
  [ChainId.ANVIL1]: "https://anvil1.bean.money:443",
  [ChainId.TESTNET]: ""
};

export const getRpcUrl = (chainId: ChainId) => {
  const url = RPC_URLS[chainId];
  if (!url) {
    throw new Error(`No RPC URL for chainId: ${chainId}`);
  }
  return url;
};
