const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
// Todo: get plot data. Example written for testing
const FARMER_PLOTS = "./reseed/data/r3-field.json";

async function reseed3(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed3: re-initialize the field and plots.\n");
  const [accountPlots, TOTAL_PODS, HARVESTABLE, HARVESTED, TEMPERATURE] = JSON.parse(
    await fs.readFileSync(FARMER_PLOTS)
  );
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedField",
    initArgs: [accountPlots, TOTAL_PODS, HARVESTABLE, HARVESTED, TEMPERATURE],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed3 = reseed3;
