const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

async function reseedGlobal(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseedGlobal: reseedGlobal.\n");

  // Files
  let globalsPath = "./reseed/data/global.json";
  let settings = JSON.parse(await fs.readFileSync(globalsPath));

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
