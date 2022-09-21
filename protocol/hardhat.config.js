require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")
require('hardhat-contract-sizer')
require("hardhat-gas-reporter")
require("solidity-coverage")
require("@openzeppelin/hardhat-upgrades")
require('dotenv').config();
const fs = require('fs')
const { upgradeWithNewFacets } = require("./scripts/diamond")
const { impersonateSigner, mintUsdc, mintBeans, getBeanMetapool, getUsdc, getBean, getBeanstalkAdminControls, impersonateBeanstalkOwner, mintEth } = require('./utils');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./test/utils/balances.js')
const { BEANSTALK, PUBLIUS, BEAN_3_CURVE } = require('./test/utils/constants.js')  
const { to6 } = require('./test/utils/helpers.js')
const { replant } = require("./replant/replant.js")
const { task } = require("hardhat/config")

task('buyBeans').addParam("amount", "The amount of USDC to buy with").setAction(async(args) => {
  await mintUsdc(PUBLIUS, args.amount)
  const signer = await impersonateSigner(PUBLIUS)
  await (await getUsdc()).connect(signer).approve(BEAN_3_CURVE, ethers.constants.MaxUint256)
  await (await getBeanMetapool()).connect(signer).exchange_underlying('2', '0', args.amount, '0')
})

task('sellBeans').addParam("amount", "The amount of Beans to sell").setAction(async(args) => {
  await mintBeans(PUBLIUS, args.amount)
  const signer = await impersonateSigner(PUBLIUS)
  await (await getBean()).connect(signer).approve(BEAN_3_CURVE, ethers.constants.MaxUint256)
  await (await getBeanMetapool()).connect(signer).connect(await impersonateSigner(PUBLIUS)).exchange_underlying('0', '2', args.amount, '0')
})

task('ripen').addParam("amount", "The amount of Pods to ripen").setAction(async(args) => {
  const beanstalkAdmin = await getBeanstalkAdminControls()
  await beanstalkAdmin.ripen(args.amount)
})

task('fertilize').addParam("amount", "The amount of Beans to fertilize").setAction(async(args) => {
  const beanstalkAdmin = await getBeanstalkAdminControls()
  await beanstalkAdmin.fertilize(args.amount)
})

task('rewardSilo').addParam("amount", "The amount of Beans to distribute to Silo").setAction(async(args) => {
  const beanstalkAdmin = await getBeanstalkAdminControls()
  await beanstalkAdmin.rewardSilo(args.amount)
})

task('sunrise', async function () {
  const beanstalkAdmin = await getBeanstalkAdminControls()
  await beanstalkAdmin.forceSunrise()
})

task('replant', async () => {
  const account = await impersonateSigner(PUBLIUS)
  await replant(account)
})

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
  abi = JSON.stringify(abi.filter((item, pos) => abi.map((a)=>a.name).indexOf(item.name) == pos), null, 4)
  fs.writeFileSync('./abi/Beanstalk.json', abi)
  console.log('ABI written to abi/Beanstalk.json')
})

task('marketplace', async function () {
  const owner = await impersonateBeanstalkOwner();
  await mintEth(owner.address);
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames:
    ['MarketplaceFacet'],
    bip: false,
    verbose: false,
    account: owner
  });
})

module.exports = {
  defaultNetwork: "localhost",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: process.env.FORKING_RPC ? {
        url: process.env.FORKING_RPC,
        blockNumber: parseInt(process.env.BLOCK_NUMBER) || undefined
      } : undefined,
      allowUnlimitedContractSize:true
    },
    localhost: {
      chainId: 1337,
      url: "http://127.0.0.1:8545/",
      timeout: 100000
    },
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_RPC || '',
      timeout: 100000
    },
    custom: {
      chainId: 133137,
      url: "<CUSTOM_URL>",
      timeout: 100000
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
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
    enabled: true
  },
  mocha: {
    timeout: 100000000
  }
}
