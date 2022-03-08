require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")
require('hardhat-contract-sizer')
require("hardhat-gas-reporter")
require("solidity-coverage")
const fs = require('fs')

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },
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

task('diamondABI', 'Generates ABI file for diamond, includes all ABIs of facets', async () => {
  const basePath = '/contracts/farm/facets/'
  const libraryBasePath = '/contracts/farm/libraries/'
  let files = fs.readdirSync('.' + basePath)
  let abi = []
  for (var file of files) {
    var file2
    var jsonFile
    if (file.includes('Facet')) {
      if (!file.includes('.sol')) {
        jsonFile = `${file}.json`
        file = `${file}/${file}.sol`
      } else {
        jsonFile = file.replace('sol', 'json');
      }
      let json = fs.readFileSync(`./artifacts${basePath}${file}/${jsonFile}`)
      json = JSON.parse(json)
      abi.push(...json.abi)
    }
  }
  abi = JSON.stringify(abi)
  fs.writeFileSync('./abi/Beanstalk.json', abi)
  console.log('ABI written to abi/Beanstalk.json')
})
