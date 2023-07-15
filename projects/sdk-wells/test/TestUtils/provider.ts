import { ethers } from "ethers";
import { BlockchainUtils } from "./BlockchainUtils";
import { WellsSDK } from "../../src/lib/WellsSDK";

// private key + account mapping
// these keys are provided by hardhat/anvil
export const ACCOUNTS = [
  ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"],
  ["0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"]
] as const;

export const getProvider = () =>
  new ethers.providers.StaticJsonRpcProvider(`http://127.0.0.1:8545`, {
    name: "foundry",
    chainId: 1337
  });

export const setupConnection = (provider: ethers.providers.JsonRpcProvider = getProvider()) => {
  const [privateKey, account] = ACCOUNTS[0];
  const signer = new ethers.Wallet(privateKey, provider);
  return {
    provider,
    signer,
    account
  };
};

export const getTestUtils = () => {
  const { signer, account } = setupConnection();
  const wellsSdk = new WellsSDK({
    signer
  });

  const utils = new BlockchainUtils(wellsSdk);

  return { wellsSdk, utils, account };
};
