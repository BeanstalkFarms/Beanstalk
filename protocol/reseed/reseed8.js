const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r8-whitelist.json";

async function reseed8(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed8: whitelist tokens.\n");
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
exports.reseed8 = reseed8;
