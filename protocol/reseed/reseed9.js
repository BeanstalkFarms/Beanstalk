const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r9-whitelist.json";

async function reseed9(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed8: whitelist tokens.\n");
  let assets = JSON.parse(await fs.readFileSync(WHITELIST_SETTINGS));
  let tokens = assets.map((asset) => asset[0]);
  let siloSettings = assets.map((asset) => asset[1]);
  let oracles = assets.map((asset) => asset[2]);

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedWhitelist",
    initArgs: [tokens, siloSettings, oracles],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed9 = reseed9;
