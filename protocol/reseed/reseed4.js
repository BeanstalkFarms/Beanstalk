const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");

async function reseed4(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed4: re-initialize the field and plots.\n");

  // Files
  let farmerPlotsPath;
  if (mock) {
    farmerPlotsPath = "./reseed/data/mocks/r4-field-mock.json";
  } else {
    farmerPlotsPath = "./reseed/data/r4-field.json";
  }
  // Read and parse the JSON file
  const accountPlots = JSON.parse(await fs.readFileSync(farmerPlotsPath));

  targetEntriesPerChunk = 800;
  plotChunks = await splitEntriesIntoChunksOptimized(accountPlots, targetEntriesPerChunk);
  const InitFacet = await ethers.getContractFactory("ReseedField", account);
  console.log(`Starting to process ${plotChunks.length} chunks...`);
  for (let i = 0; i < plotChunks.length; i++) {
    await updateProgress(i + 1, plotChunks.length);
    if (verbose) {
      console.log("Data chunk:", plotChunks[i]);
      console.log("-----------------------------------");
    }
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetAddress: InitFacet.address,
      initArgs: [plotChunks[i]],
      bip: false,
      verbose: verbose,
      account: account,
      checkGas: true
    });
  }
}

exports.reseed4 = reseed4;
