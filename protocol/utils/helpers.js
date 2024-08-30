const { impersonateSigner } = require("../utils/signer.js");

function toBN(a) {
  return ethers.BigNumber.from(a);
}

async function advanceTime(time) {
  let timestamp = (await ethers.provider.getBlock("latest")).timestamp;
  timestamp += time;
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp]
  });
}

async function changeNetwork(networkName, url, account = undefined) {
  // Fetch the network configuration from hardhat.config.js
  const networkConfig = hre.config.networks[networkName];
  if (!networkConfig) {
    throw new Error(`Network ${networkName} is not configured in hardhat.config.js`);
  }
  // Override the network in the Hardhat Runtime Environment (HRE)
  hre.network.name = networkName;
  hre.network.config = networkConfig;
  // hre.network.provider = await hre.ethers.getDefaultProvider(networkConfig.url);
  hre.network.provider = new hre.ethers.providers.getDefaultProvider(url);
  // Reinitialize ethers
  hre.ethers.provider = hre.network.provider;
  // Validate that the provider is correctly set up
  const network = await hre.network.provider.getNetwork();
  console.log(`Connected to network: ${network.name} (chainId: ${network.chainId} at ${network.url})`);
  if (account) {
    await impersonateSigner(account);
  }
}

exports.toBN = toBN;
exports.advanceTime = advanceTime;
exports.changeNetwork = changeNetwork;
