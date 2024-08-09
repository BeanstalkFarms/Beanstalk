const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const GLOBAL_SETTINGS = "./reseed/data/global.json";

async function reseedGlobal(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseedGlobal: reseedGlobal.\n");
  let settings = JSON.parse(await fs.readFileSync(GLOBAL_SETTINGS));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedGlobal",
    initArgs: [settings],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseedGlobal = reseedGlobal;
