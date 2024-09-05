const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { deployContract } = require("../scripts/contracts");
const fs = require("fs");

async function reseed9(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseed9: whitelist tokens.\n");

  // Files
  let whitelistSettingsPath;
  if (mock) {
    whitelistSettingsPath = "./reseed/data/mocks/r9-whitelist-mock.json";
  } else {
    whitelistSettingsPath = "./reseed/data/r9-whitelist.json";
  }

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
