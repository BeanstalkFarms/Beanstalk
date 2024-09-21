const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");
const { retryOperation } = require("../utils/read.js");

async function reseed3(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed3: re-initialize the field and plots.\n");

  // Files
  let farmerPlotsPath;
  if (mock) {
    farmerPlotsPath = "./reseed/data/mocks/r3-field-mock.json";
  } else {
    farmerPlotsPath = "./reseed/data/r3-field.json";
  }
  // Read and parse the JSON file
  const accountPlots = JSON.parse(await fs.readFileSync(farmerPlotsPath));

  targetEntriesPerChunk = 10;
  plotChunks = await splitEntriesIntoChunksOptimized(accountPlots, targetEntriesPerChunk);
  const InitFacet = await (await ethers.getContractFactory("ReseedField", account)).deploy();
  await InitFacet.deployed();
  console.log(`Starting to process ${plotChunks.length} chunks...`);
  for (let i = 0; i < plotChunks.length; i++) {
    await updateProgress(i + 1, plotChunks.length);
    if (verbose) {
      console.log("Data chunk:", plotChunks[i]);
      console.log("-----------------------------------");
    }
    await retryOperation(async () => {
      await upgradeWithNewFacets({
        diamondAddress: L2Beanstalk,
        facetNames: [],
        initFacetName: "ReseedField",
        initFacetAddress: InitFacet.address,
        initArgs: [plotChunks[i]],
        bip: false,
        verbose: verbose,
        account: account,
        checkGas: true,
        initFacetNameInfo: "ReseedField"
      });
    });
  }
}

exports.reseed3 = reseed3;
