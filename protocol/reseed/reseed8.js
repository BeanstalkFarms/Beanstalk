const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { deployContract } = require("../scripts/contracts");
const { L2_WEETH } = require("../test/hardhat/utils/constants.js");
const fs = require("fs");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r8-whitelist.json";

async function reseed8(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed8: whitelist tokens.\n");
  let assets = JSON.parse(await fs.readFileSync(WHITELIST_SETTINGS));
  let tokens = assets.map((asset) => asset[0]);
  let siloSettings = assets.map((asset) => asset[1]);
  let whitelistStatuses = assets.map((asset) => asset[2]);
  let oracles = assets.map((asset) => asset[3]);

  // deploy LSD chainlink oracle for whitelist:
  await deployContract("LSDChainlinkOracle", account, true, [
    "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // ETH/USD oracle.
    "14400", // 4 hours
    "0xE141425bc1594b8039De6390db1cDaf4397EA22b", // LSD/ETH oracle.
    "345600", // 4 days
    L2_WEETH // LSD token
  ]);

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedWhitelist",
    initArgs: [tokens, siloSettings, whitelistStatuses, oracles],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed8 = reseed8;
