const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

// Files
// Todo: get plot data. Example written for testing
const FARMER_PLOTS = "./reseed/data/r4-field.json";

async function reseed4(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed4: re-initialize the field and plots.\n");

  // Read and parse the JSON file
  const accountPlots = JSON.parse(await fs.readFileSync(FARMER_PLOTS));

  chunkSize = 2;
  plotChunks = splitEntriesIntoChunks(accountPlots, chunkSize);
  
  for (let i = 0; i < plotChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${plotChunks.length}`);
    console.log("Data chunk:", plotChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedField",
      initArgs: [plotChunks[i]],
      bip: false,
      verbose: true,
      account: account
    });
    console.log("-----------------------------------");
  }

}

exports.reseed4 = reseed4;
