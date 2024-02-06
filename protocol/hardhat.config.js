const path = require("path");
const fs = require("fs");
const glob = require("glob");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-tracer");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");

// BIP 38 migration ----
const { bipMigrateUnripeBean3CrvToBeanEth } = require("./scripts/bips.js");
const { finishBeanEthMigration } = require("./scripts/beanEthMigration.js");
// ----

const { upgradeWithNewFacets } = require("./scripts/diamond");
const {
  impersonateSigner,
  mintUsdc,
  mintBeans,
  getBeanMetapool,
  getUsdc,
  getBean,
  getBeanstalkAdminControls,
  impersonateBeanstalkOwner,
  mintEth,
  getBeanstalk
} = require("./utils");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./test/utils/balances.js");
const { BEANSTALK, PUBLIUS, BEAN_3_CURVE, BEAN_ETH_WELL } = require("./test/utils/constants.js");
const { to6 } = require("./test/utils/helpers.js");
//const { replant } = require("./replant/replant.js")
const { task } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");
const { bipNewSilo, mockBeanstalkAdmin } = require("./scripts/bips.js");
const { ebip9, ebip10, ebip11, ebip13, ebip14 } = require("./scripts/ebips.js");

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
    await mintEth(PUBLIUS);
    await mintUsdc(PUBLIUS, args.amount);
    const signer = await impersonateSigner(PUBLIUS);
    await (await getUsdc()).connect(signer).approve(BEAN_3_CURVE, ethers.constants.MaxUint256);
    const txn = await (await getBeanMetapool()).connect(signer).exchange_underlying("2", "0", args.amount, "0");
    const result = await txn.wait();
    console.log("Done", result);
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

task("sunrise2", async function () {
  const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
  const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])

  season = await ethers.getContractAt('SeasonFacet', BEANSTALK);
  await season.sunrise();
})

task("getTime", async function () {
  this.season = await ethers.getContractAt("SeasonFacet", BEANSTALK);
  console.log("Current time: ", await this.season.time());
});

/*task('replant', async () => {
  const account = await impersonateSigner(PUBLIUS)
  await replant(account)
})*/

task("diamondABI", "Generates ABI file for diamond, includes all ABIs of facets", async () => {
  // The path (relative to the root of `protocol` directory) where all modules sit.
  const modulesDir = path.join("contracts", "beanstalk");

  // The list of modules to combine into a single ABI. All facets (and facet dependencies) will be aggregated.
  const modules = ["barn", "diamond", "farm", "field", "market", "silo", "sun"];

  // The glob returns the full file path like this:
  // contracts/beanstalk/barn/UnripeFacet.sol
  // We want the "UnripeFacet" part.
  const getFacetName = (file) => {
    return file.split("/").pop().split(".")[0];
  };

  // Load files across all modules
  const paths = [];
  modules.forEach((module) => {
    const filesInModule = fs.readdirSync(path.join(".", modulesDir, module));
    paths.push(...filesInModule.map((f) => [module, f]));
  });

  // Build ABI
  let abi = [];
  modules.forEach((module) => {
    const pattern = path.join(".", modulesDir, module, "**", "*Facet.sol");
    const files = glob.sync(pattern);

    files.forEach((file) => {
      const facetName = getFacetName(file);
      const jsonFileName = `${facetName}.json`;
      const jsonFileLoc = path.join(".", "artifacts", file, jsonFileName);

      const json = JSON.parse(fs.readFileSync(jsonFileLoc));

      // Log what's being included
      console.log(`${module}:`.padEnd(10), file);
      json.abi.forEach((item) => console.log(``.padEnd(10), item.type, item.name));
      console.log("");

      abi.push(...json.abi);
    });
  });

  const names = abi.map((a) => a.name);
  fs.writeFileSync(
    "./abi/Beanstalk.json",
    JSON.stringify(
      abi.filter((item, pos) => names.indexOf(item.name) == pos),
      null,
      2
    )
  );

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

task("silov3", async function () {
  await bipNewSilo();
});

task("beanstalkAdmin", async function () {
  await mockBeanstalkAdmin();
});

task("migrate-bip38", async function () {
  await bipMigrateUnripeBean3CrvToBeanEth();
  await finishBeanEthMigration();
});

task("ebip14", async function () {
  await ebip14();
})

task("ebip13", async function () {
  await ebip13();
})

task("ebip11", async function () {
  await ebip11();
})

task("ebip10", async function () {
  await ebip10();
})

task("ebip9", async function () {
  await ebip9();
})

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
      timeout: 100000,
      accounts: "remote"
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
    },
    testSiloV3: {
      chainId: 31337,
      url: "https://rpc.vnet.tenderly.co/devnet/silo-v3/3ed19e82-a81c-45e5-9b16-5e385aa74587",
      timeout: 100000
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_RPC || "",
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
            runs: 100
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
  paths: {
    sources: "./contracts",
    cache: "./cache"
  }
};
