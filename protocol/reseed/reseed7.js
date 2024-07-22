const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { convertToInt } = require("../utils/read.js");

// Files
const WHITELIST_SETTINGS = "./reseed/data/r7-whitelist.json";

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed7: whitelist tokens.\n");
  let assets = JSON.parse(await fs.readFileSync(WHITELIST_SETTINGS));
  let tokens = assets.map((asset) => asset[0]);
  let siloSettings = assets.map((asset) => asset[1]);

  // convert string numbers to integers
  [siloSettings] = [siloSettings].map(convertToInt);

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
