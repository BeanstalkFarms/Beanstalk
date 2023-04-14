require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@foundry-rs/hardhat-anvil");

module.exports = {
  defaultNetwork: "anvil",
  networks: {
    anvil: {
      url: "http://127.0.0.1:8545/",
      launch: true,
      forkUrl: process.env.FORK_URL,
      forkBlockNumber: 15577000,
      chainId: 1337
    }
  },
  mocha: {
    reporter: "spec"
  }
};
