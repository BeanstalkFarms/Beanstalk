const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
// Todo: get plot data. Example written for testing
const FARMER_PLOTS = "./reseed/data/r4-field.json";

async function reseed4(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed4: re-initialize the field and plots.\n");

  // Read and parse the JSON file
  const accountPlots = JSON.parse(await fs.readFileSync(FARMER_PLOTS));
  
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedField",
    initArgs: [accountPlots],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}

exports.reseed4 = reseed4;
