require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")
require('hardhat-contract-sizer')
require("hardhat-gas-reporter")
require("solidity-coverage")

const PRIVATE_KEY = ""
const API_KEY = ""
const URL = "https://mainnet.infura.io/v3/"
const ROPSTEN_URL = "https://ropsten.infura.io/v3/"

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: `${URL}${API_KEY}`,
        accounts: [`0x${PRIVATE_KEY}`]
      },
      gasPrice:0,
      allowUnlimitedContractSize:true,
      blockGasLimit: 9500000
    },
    localhost: {
      chainId: 1337,
      url: "http://127.0.0.1:8545"
    },
    mainnet: {
      chainId: 1,
      url: `${URL}${API_KEY}`,
      accounts: [`0x${PRIVATE_KEY}`],
      gasPrice: 50000000000
    },
    ropsten: {
      chainId: 3,
      url: `${ROPSTEN_URL}${API_KEY}`,
      accounts: [`0x${PRIVATE_KEY}`],
      gasPrice: 50000000000
    }
  },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  gasReporter: {
    enabled: false
  },
  mocha: {
    timeout: 100000
  }
}
