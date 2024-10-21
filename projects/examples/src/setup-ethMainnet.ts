// import { BeanstalkSDK, DataSource, TestUtils } from "@beanstalk/sdk";
// import { ChainId } from "@beanstalk/sdk-core";
// import { Provider } from "@beanstalk/sdk-wells/dist/types/lib/WellsSDK";
// import { ethers } from "ethers";

// keeping these in the same file as ./setup for some reasons causes issues

// const RPC_URL = "http://127.0.0.1:9545";

// const network = {
//   name: "local-eth-mainnet",
//   chainId: ChainId.LOCALHOST_ETH,
//   _defaultProvider: () => new ethers.providers.JsonRpcProvider(RPC_URL, network)
// };

// const provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, network);

// const connection = TestUtils.setupConnection(provider);

// const { signer, account } = connection;

// const sdk = new BeanstalkSDK({
//   signer: signer,
//   rpcUrl: RPC_URL,
//   DEBUG: true
// });

// const chain = new TestUtils.BlockchainUtils(sdk);

// const impersonate = async (account) => {
//   const stop = await chain.impersonate(account);
//   const provider = ethers.getDefaultProvider(network) as Provider;
//   const signer = await provider.getSigner(account);
//   const sdk = new BeanstalkSDK({
//     signer,
//     source: DataSource.LEDGER,
//     DEBUG: true
//   });

//   return { sdk, stop };
// };

// const ethMainnetUtils = {
//   signer,
//   account,
//   provider,
//   sdk,
//   impersonate,
//   chain
// };

// export default ethMainnetUtils;
