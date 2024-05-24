const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r7-whitelist.json";

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed7: whitelist tokens.\n");
  const [tokens, siloSettings] = JSON.parse(await fs.readFileSync(WHITELIST_SETTINGS));
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedWhitelist",
    initArgs: [tokens, siloSettings],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed7 = reseed7;
