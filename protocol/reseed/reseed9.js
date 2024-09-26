const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { retryOperation } = require("../utils/read.js");

async function reseed9(account, L2Beanstalk, mock = false) {
  console.log("-----------------------------------");
  console.log("reseed9: whitelist tokens.\n");

  // Files
  let whitelistSettingsPath;
  if (mock) {
    whitelistSettingsPath = "./reseed/data/mocks/r9-whitelist-mock.json";
  } else {
    whitelistSettingsPath = "./reseed/data/r9-whitelist.json";
  }

  let assets = JSON.parse(await fs.readFileSync(whitelistSettingsPath));
  let tokens = assets.map((asset) => asset[0]);
  let nonBeanTokens = assets.map((asset) => asset[1]);
  let siloSettings = assets.map((asset) => asset[2]);
  let whitelistStatuses = assets.map((asset) => asset[3]);
  let oracles = assets.map((asset) => asset[4]);

  await retryOperation(async () => {
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedWhitelist",
      initArgs: [tokens, nonBeanTokens, siloSettings, whitelistStatuses, oracles],
      bip: false,
      verbose: true,
      account: account
    });
  });
  console.log("-----------------------------------");
}
exports.reseed9 = reseed9;
