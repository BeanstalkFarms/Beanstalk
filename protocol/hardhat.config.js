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
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { upgradeWithNewFacets } = require("./scripts/diamond");
const {
  impersonateSigner,
  mintUsdc,
  mintBeans,
  getUsdc,
  getBean,
  getBeanstalkAdminControls,
  impersonateBeanstalkOwner,
  mintEth,
  getBeanstalk
} = require("./utils");
const {
  EXTERNAL,
  INTERNAL,
  INTERNAL_EXTERNAL,
  INTERNAL_TOLERANT
} = require("./test/hardhat/utils/balances.js");
const {
  BEANSTALK,
  PUBLIUS,
  BEAN_ETH_WELL,
  BCM,
  L2_BCM,
  L2_BEANSTALK,
  BEAN
} = require("./test/hardhat/utils/constants.js");
const { to6 } = require("./test/hardhat/utils/helpers.js");
//const { replant } = require("./replant/replant.js")
const { reseedL2 } = require("./reseed/reseedL2.js");
const { reseedL1 } = require("./reseed/reseedL1.js");
const { reseed10 } = require("./reseed/reseed10.js");
const { task } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");
const {
  bipNewSilo,
  bipMorningAuction,
  bipSeedGauge,
  bipMiscellaneousImprovements
} = require("./scripts/bips.js");
const { ebip9, ebip10, ebip11, ebip13, ebip14, ebip15 } = require("./scripts/ebips.js");

//////////////////////// UTILITIES ////////////////////////

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}

//////////////////////// TASKS ////////////////////////

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
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp]);

  season = await ethers.getContractAt("SeasonFacet", BEANSTALK);
  await season.sunrise();
});

task("sunriseArb", async function () {
  beanstalk = await getBeanstalk("0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70");
  // Simulate the transaction to check if it would succeed
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600;
  const additionalSeconds = 12;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp + additionalSeconds]);
  await beanstalk.sunrise();
  await network.provider.send("evm_mine");
  const unixTime = await time.latest();
  const currentTime = new Date(unixTime * 1000).toLocaleString();

  console.log(
    "sunrise complete!\ncurrent season:",
    await beanstalk.season(),
    "\ncurrent blockchain time:",
    unixTime,
    "\nhuman readable time:",
    currentTime,
    "\ncurrent block:",
    (await ethers.provider.getBlock("latest")).number,
    "\ndeltaB:",
    (await beanstalk.totalDeltaB()).toString()
  );
});

task("getTime", async function () {
  beanstalk = await ethers.getContractAt("SeasonFacet", BEANSTALK);
  console.log("Current time: ", await this.seasonGetter.time());
});

task("tokenSettings", async function () {
  beanstalk = await getBeanstalk("0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70");
  const tokenSettings = await beanstalk.tokenSettings("0xBEA0005B8599265D41256905A9B3073D397812E4");
  console.log(tokenSettings);
});

/*task('replant', async () => {
  const account = await impersonateSigner(PUBLIUS)
  await replant(account)
})*/

task("reseedL1", async () => {
  // mint more eth to the bcm to cover gas costs.
  let bcm = await impersonateSigner(BCM);
  await mintEth(bcm.address);
  await reseedL1(bcm);
});

task("reseedL2", async () => {
  // the account that deploys the new diamond address at nonce 0.
  mock = true;
  let beanstalkDeployer;
  if (mock) {
    beanstalkDeployer = await impersonateSigner("0xe26367ca850da09a478076481535d7c1c67d62f9");
    await mintEth(beanstalkDeployer.address);
  } else {
    beanstalkDeployer = new ethers.Wallet(process.env.DIAMOND_DEPLOYER_PK, ethers.provider);
    console.log("Deployer address: ", await beanstalkDeployer.getAddress());
  }
  await reseedL2({
    beanstalkDeployer: beanstalkDeployer,
    setState: true,
    addLiquidity: false
  });
});

// Prior to the last reseed (i.e, adding facets to L2 beanstalk),
// the beanstalk owner needs to accept ownership of beanstalk.
// The ownership facet will already be added to the diamond
// and the deployer will have already proposed the l2 owner as the new owner.
// After claiming ownership, run this task to get the diamond cut json for the bcm to sign.
task("reseedL2AddFacets", async () => {
  const mock = false;
  let l2bcm = await impersonateSigner(L2_BCM);
  await mintEth(l2bcm.address);
  // add selectors to l2 beanstalk from the already deployed facets
  await reseed10(l2bcm, L2_BEANSTALK, mock);
});

// deploys the L1RecieverFacet with updated merkle roots.
// To be done after pausing of beanstalk.
// After deployment, copy the address of the new L1RecieverFacet and update reseed10.js.
task("deployL1ReceiverFacet", async function () {
  const mock = true;
  let deployer;
  if (mock) {
    deployer = await impersonateSigner("0xe26367ca850da09a478076481535d7c1c67d62f9");
    await mintEth(deployer.address);
  } else {
    deployer = new ethers.Wallet(process.env.DIAMOND_DEPLOYER_PK, ethers.provider);
    console.log("Deployer address: ", deployer.getAddress());
  }

  const L1ReceiverFacet = await ethers.getContractFactory("L1ReceiverFacet", {
    libraries: {
      // deployed libraries on arb
      LibSilo: "0xdDe5EF030cC400EF2Ea7c37f0819b59217F6bb34",
      LibTokenSilo: "0x6C5860E9Fc6B35cfe3C98A4f5Aa686C7cf9F7981"
    }
  });
  const l1ReceiverFacet = await L1ReceiverFacet.deploy();
  await l1ReceiverFacet.deployed();
  console.log("L1ReceiverFacet deployed to:", l1ReceiverFacet.address);
  console.log("Please update reseed10.js with the new L1ReceiverFacet address.");
});

// Performs the final reseed step, adding all facets to the beanstalk diamond.
// Used to verify state prior to running the foundry tests after the reseed scripts.
task("addFacetsToDiamond", async function () {
  let l2Owner = await impersonateSigner("0xe26367ca850da09a478076481535d7c1c67d62f9");
  await mintEth(l2Owner.address);
  await reseed10(l2Owner, L2_BEANSTALK, true);
});

// example usage:
// npx hardhat measureGasUsed --start 244125439 --end 244125766 --network localhost
// currently reseed uses 3381686192 gas on Arbitrum
task("measureGasUsed")
  .addParam("start", "The start block to measure gas used from")
  .addParam("end", "The end block to measure gas used to")
  .setAction(async (args, hre) => {
    const provider = hre.ethers.provider;
    // Convert string inputs to numbers
    const startBlock = parseInt(args.start, 10);
    const endBlock = parseInt(args.end, 10);
    if (isNaN(startBlock) || isNaN(endBlock)) {
      throw new Error("Invalid block numbers provided. Please ensure they are valid integers.");
    }

    let totalGasUsed = hre.ethers.BigNumber.from(0);

    // Iterate through all blocks and sum up the gas used
    for (let i = startBlock; i <= endBlock; i++) {
      const block = await provider.getBlock(i);
      totalGasUsed = totalGasUsed.add(block.gasUsed);
    }

    console.log(
      `Total gas used between blocks ${startBlock} and ${endBlock}: ${totalGasUsed.toString()}`
    );
  });

task("diamondABI", "Generates ABI file for diamond, includes all ABIs of facets", async () => {
  // The path (relative to the root of `protocol` directory) where all modules sit.
  const modulesDir = path.join("contracts", "beanstalk");

  // The list of modules to combine into a single ABI. All facets (and facet dependencies) will be aggregated.
  const modules = [
    "barn",
    "diamond",
    "farm",
    "field",
    "market",
    "silo",
    "sun",
    "metadata",
    "migration"
  ];

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
    if (module == "silo") {
      // Manually add in libraries that emit events
      files.push("contracts/libraries/LibIncentive.sol");
      files.push("contracts/libraries/Silo/LibGerminate.sol");
      files.push("contracts/libraries/Minting/LibWellMinting.sol");
      files.push("contracts/libraries/Silo/LibWhitelistedTokens.sol");
      files.push("contracts/libraries/Silo/LibWhitelist.sol");
      files.push("contracts/libraries/LibGauge.sol");
      files.push("contracts/libraries/LibShipping.sol");
      files.push("contracts/libraries/Token/LibTransfer.sol");

      // add init reseed events that emit events.
      files.push("contracts/beanstalk/init/reseed/L2/ReseedAccountStatus.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedBarn.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedBean.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedField.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedGlobal.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedInternalBalances.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedPodMarket.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedSilo.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedTransferOwnership.sol");
      files.push("contracts/beanstalk/init/reseed/L2/ReseedWhitelist.sol");
    }
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

/**
 * @notice generates mock diamond ABI.
 */
task("mockDiamondABI", "Generates ABI file for mock contracts", async () => {
  //////////////////////// FACETS ////////////////////////

  // The path (relative to the root of `protocol` directory) where all modules sit.
  const modulesDir = path.join("contracts", "beanstalk");

  // The list of modules to combine into a single ABI. All facets (and facet dependencies) will be aggregated.
  const modules = [
    "barn",
    "diamond",
    "farm",
    "field",
    "market",
    "silo",
    "sun",
    "metadata",
    "migration"
  ];

  // The glob returns the full file path like this:
  // contracts/beanstalk/barn/UnripeFacet.sol
  // We want the "UnripeFacet" part.
  const getFacetName = (file) => {
    return file.split("/").pop().split(".")[0];
  };

  // Load files across all modules
  let paths = [];
  modules.forEach((module) => {
    const filesInModule = fs.readdirSync(path.join(".", modulesDir, module));
    paths.push(...filesInModule.map((f) => [module, f]));
  });

  // Build ABI
  let abi = [];
  modules.forEach((module) => {
    const pattern = path.join(".", modulesDir, module, "**", "*Facet.sol");
    const files = glob.sync(pattern);
    if (module == "silo") {
      // Manually add in libraries that emit events
      files.push("contracts/libraries/LibIncentive.sol");
      files.push("contracts/libraries/Silo/LibWhitelist.sol");
      files.push("contracts/libraries/LibGauge.sol");
      files.push("contracts/libraries/Silo/LibGerminate.sol");
    }
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

  let string = "./abi/Beanstalk.json";

  ////////////////////////// MOCK ////////////////////////
  // The path (relative to the root of `protocol` directory) where all modules sit.
  const mockModulesDir = path.join("contracts", "mocks", "mockFacets");

  // Load files across all mock modules.
  const filesInModule = fs.readdirSync(path.join(".", mockModulesDir));
  console.log("Mock Facets:");
  console.log(filesInModule);

  // Build ABI
  filesInModule.forEach((module) => {
    const file = path.join(".", mockModulesDir, module);
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

  const names = abi.map((a) => a.name);
  fs.writeFileSync(
    "./abi/MockBeanstalk.json",
    JSON.stringify(
      abi.filter((item, pos) => names.indexOf(item.name) == pos),
      null,
      2
    )
  );
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

task("deployMorningAuction", async function () {
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

task("deploySiloV3", async function () {
  await bipNewSilo();
});

task("deploySeedGauge", async function () {
  await bipSeedGauge();
});

task("deployWstethMigration", async function () {
  await bipMigrateUnripeBeanEthToBeanSteth();
});

task("deployBipMiscImprovements", async function () {
  await bipMiscellaneousImprovements();
});

task("updateBeanstalkForUI", async function () {
  await updateBeanstalkForUI();
});

/// EBIPS ///

task("ebip17", async function () {
  await ebip17();
});

task("ebip16", async function () {
  await ebip16();
});

task("ebip15", async function () {
  await ebip15();
});

task("ebip14", async function () {
  await ebip14();
});

task("ebip13", async function () {
  await ebip13();
});

task("ebip11", async function () {
  await ebip11();
});

task("ebip10", async function () {
  await ebip10();
});

task("ebip9", async function () {
  await ebip9();
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
      timeout: 1000000000,
      accounts: "remote"
    },
    localhostL1: {
      chainId: 1338,
      url: "http://127.0.0.1:9545/",
      timeout: 1000000000,
      accounts: "remote"
    },
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_RPC || "",
      timeout: 1000000000
    },
    arbitrum: {
      chainId: 42161,
      url: process.env.ARBITRUM_RPC || "",
      timeout: 1000000000
    },
    custom: {
      chainId: 133137,
      url: "<CUSTOM_URL>",
      timeout: 100000
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_RPC || "",
      timeout: 100000
    }
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ETHERSCAN_KEY_ARBITRUM,
      mainnet: process.env.ETHERSCAN_KEY
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100
          }
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100
          }
        }
      }
    ]
  },
  gasReporter: {
    enabled: false
  },
  mocha: {
    timeout: 100000000
  },
  paths: {
    sources: "./contracts",
    cache: "./cache"
  },
  ignoreWarnings: [
    'code["5574"]' // Ignores the specific warning about duplicate definitions
  ]
};
