const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { deployContract } = require("../scripts/contracts");
const fs = require("fs");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r9-whitelist.json";

async function reseed9(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseed9: whitelist tokens.\n");
  let assets = JSON.parse(await fs.readFileSync(WHITELIST_SETTINGS));
  let tokens = assets.map((asset) => asset[0]);
  let nonBeanTokens = assets.map((asset) => asset[1]);
  let siloSettings = assets.map((asset) => asset[2]);
  let whitelistStatuses = assets.map((asset) => asset[3]);
  let oracles = assets.map((asset) => asset[4]);

  // deploy LSD chainlink oracle for whitelist:
  await deployContract("LSDChainlinkOracle", account, true, []);

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedWhitelist",
    initArgs: [tokens, nonBeanTokens, siloSettings, whitelistStatuses, oracles],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed9 = reseed9;
