import { BeanstalkSDK, ChainId, DataSource, TestUtils } from "@beanstalk/sdk";
import { Provider } from "@beanstalk/sdk/dist/types/lib/BeanstalkSDK";
import { ethers } from "ethers";

const RPC_URL = "http://127.0.0.1:8545";

const network = {
  name: "local",
  chainId: ChainId.LOCALHOST,
  _defaultProvider: () => new ethers.providers.JsonRpcProvider(RPC_URL)
};
// const RPC_URL = "https://anvil1.bean.money:443"
export const provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, network);
export const { signer, account } = TestUtils.setupConnection(provider);

export const sdk = new BeanstalkSDK({
  signer,
  rpcUrl: RPC_URL,
  provider: provider,
  source: DataSource.LEDGER,
  DEBUG: true
});

export const impersonate = async (account) => {
  const stop = await chain.impersonate(account);
  const provider = ethers.getDefaultProvider(network) as Provider;
  const signer = await provider.getSigner(account);
  const sdk = new BeanstalkSDK({
    signer,
    source: DataSource.LEDGER,
    DEBUG: true
  });

  return { sdk, stop };
};

export const chain = new TestUtils.BlockchainUtils(sdk);
