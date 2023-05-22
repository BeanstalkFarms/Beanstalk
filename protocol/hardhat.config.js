require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-tracer");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
require("hardhat-preprocessor");
require('hardhat-contract-sizer');

const fs = require('fs')
const { upgradeWithNewFacets } = require("./scripts/diamond")
const { impersonateSigner, mintUsdc, mintBeans, getBeanMetapool, getUsdc, getBean, getBeanstalkAdminControls, impersonateBeanstalkOwner, mintEth } = require('./utils');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./test/utils/balances.js')
const { BEANSTALK, PUBLIUS, BEAN_3_CURVE } = require('./test/utils/constants.js')  
const { to6 } = require('./test/utils/helpers.js')
//const { replant } = require("./replant/replant.js")
const { task } = require("hardhat/config")
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");

//////////////////////// UTILITIES ////////////////////////

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}

//////////////////////// TASKS ////////////////////////

task("buyBeans")
  .addParam("amount", "The amount of USDC to buy with")
  .setAction(async (args) => {
    await mintUsdc(PUBLIUS, args.amount);
    const signer = await impersonateSigner(PUBLIUS);
    await (await getUsdc()).connect(signer).approve(BEAN_3_CURVE, ethers.constants.MaxUint256);
    await (await getBeanMetapool()).connect(signer).exchange_underlying("2", "0", args.amount, "0");
  });

task("sellBeans")
  .addParam("amount", "The amount of Beans to sell")
  .setAction(async (args) => {
    await mintBeans(PUBLIUS, args.amount);
    const signer = await impersonateSigner(PUBLIUS);
    await (await getBean()).connect(signer).approve(BEAN_3_CURVE, ethers.constants.MaxUint256);
    await (
      await getBeanMetapool()
    )
      .connect(signer)
      .connect(await impersonateSigner(PUBLIUS))
      .exchange_underlying("0", "2", args.amount, "0");
  });

task("ripen")
  .addParam("amount", "The amount of Pods to ripen")
  .setAction(async (args) => {
    const beanstalkAdmin = await getBeanstalkAdminControls();
    await beanstalkAdmin.ripen(args.amount);
  });

task("fertilize")
  .addParam("amount", "The amount of Beans to fertilize")
  .setAction(async (args) => {
    const beanstalkAdmin = await getBeanstalkAdminControls();
    await beanstalkAdmin.fertilize(args.amount);
  });

task("rewardSilo")
  .addParam("amount", "The amount of Beans to distribute to Silo")
  .setAction(async (args) => {
    const beanstalkAdmin = await getBeanstalkAdminControls();
    await beanstalkAdmin.rewardSilo(args.amount);
  });

task("sunrise", async function () {
  const beanstalkAdmin = await getBeanstalkAdminControls();
  await beanstalkAdmin.forceSunrise();
});

/*task('replant', async () => {
  const account = await impersonateSigner(PUBLIUS)
  await replant(account)
})*/

task("diamondABI", "Generates ABI file for diamond, includes all ABIs of facets", async () => {
  const basePath = "/contracts/beanstalk/";
  const modules = ["barn", "diamond", "farm", "field", "market", "silo", "sun"];

  // Load files across all modules
  const paths = [];
  modules.forEach((m) => {
    const filesInModule = fs.readdirSync(`.${basePath}${m}`);
    paths.push(...filesInModule.map((f) => [m, f]));
  });

  // Build ABI
  let abi = [];
  for (var [module, file] of paths) {
    // We're only interested in facets
    if (file.includes("Facet")) {
      let jsonFile;

      // A Facet can be packaged in two formats:
      //  1. XYZFacet.sol
      //  2. XYZFacet/XYZFacet.sol
      // By convention, a folder ending with "Facet" will also contain a .sol file with the same name.
      if (!file.includes(".sol")) {
        // This is a directory
        jsonFile = `${file}.json`;
        file = `${file}/${file}.sol`;
      } else {
        // This is a file
        jsonFile = file.replace("sol", "json");
      }

      const loc = `./artifacts${basePath}${module}/${file}/${jsonFile}`;
      console.log(`ADD:  `, module, file, "=>", loc);

      const json = JSON.parse(fs.readFileSync(loc));
      abi.push(...json.abi);
    } else {
      console.log(`SKIP: `, module, file);
    }
  }

  fs.writeFileSync("./abi/Beanstalk.json", JSON.stringify(abi.filter((item, pos) => abi.map((a) => a.name).indexOf(item.name) == pos)));

  console.log("ABI written to abi/Beanstalk.json");
});

task("marketplace", async function () {
  const owner = await impersonateBeanstalkOwner();
  await mintEth(owner.address);
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["MarketplaceFacet"],
    bip: false,
    verbose: false,
    account: owner
  });
});

task("bip34", async function () {
  const owner = await impersonateBeanstalkOwner();
  await mintEth(owner.address);
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "FieldFacet", // Add Morning Auction
      "SeasonFacet", // Add ERC-20 permit function
      "FundraiserFacet" // update fundraiser with new soil spec
      // 'MockAdminFacet' // Add MockAdmin for testing purposes
    ],
    initFacetName: "InitBipSunriseImprovements",
    initArgs: [],
    bip: false,
    verbose: true,
    account: owner
  });
});

//////////////////////// SUBTASK CONFIGURATION ////////////////////////

// Add a subtask that sets the action for the TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS task
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  // Get the list of source paths that would normally be passed to the Solidity compiler
  var paths = await runSuper();

  // Apply a filter function to exclude paths that contain the string "replant" to ignore replant code
  paths = paths.filter((p) => !p.includes("replant"));
  paths = paths.filter((p) => !p.includes("Root.sol"));
  return paths;
});

//////////////////////// CONFIGURATION ////////////////////////

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: process.env.FORKING_RPC
        ? {
            url: process.env.FORKING_RPC,
            blockNumber: parseInt(process.env.BLOCK_NUMBER) || undefined
          }
        : undefined,
      allowUnlimitedContractSize: true
    },
    localhost: {
      chainId: 1337,
      url: "http://127.0.0.1:8545/",
      timeout: 100000
    },
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_RPC || "",
      timeout: 100000
    },
    custom: {
      chainId: 133137,
      url: "<CUSTOM_URL>",
      timeout: 100000
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    ],
    overrides: {
      "@uniswap/v3-core/contracts/libraries/TickBitmap.sol": {
        version: "0.7.6",
        settings: {}
      }
    }
  },
  gasReporter: {
    enabled: true
  },
  mocha: {
    timeout: 100000000
  },
  // The following is pulled from this Foundry guide:
  // https://book.getfoundry.sh/config/hardhat#instructions
  preprocess: {
    eachLine: (hre) => ({
      transform: (line) => {
        if (line.match(/^\s*import /i)) {
          for (const [from, to] of getRemappings()) {
            if (line.includes(from)) {
              line = line.replace(from, to);
              break;
            }
          }
        }
        return line;
      }
    })
  },
  paths: {
    sources: "./contracts",
    cache: "./cache"
  }
};
