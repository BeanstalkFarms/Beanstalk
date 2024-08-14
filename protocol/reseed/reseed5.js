const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");

async function reseed5(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue fertilizer, reinitialize fertilizer holder state.\n");

  // Files
  let barnRaisePath;
  if (mock) {
    barnRaisePath = "./reseed/data/mocks/r5-barn-raise-mock.json";
  } else {
    barnRaisePath = "./reseed/data/r5-barn-raise.json";
  }
  const fertilizerIds = JSON.parse(await fs.readFileSync(barnRaisePath));

  targetEntriesPerChunk = 800;
  fertChunks = await splitEntriesIntoChunksOptimized(fertilizerIds, targetEntriesPerChunk);
  const InitFacet = await ethers.getContractFactory("ReseedBarn", account);
  for (let i = 0; i < fertChunks.length; i++) {
    await updateProgress(i + 1, plotChunks.length);
    if (verbose) {
      console.log("Data chunk:", fertChunks[i]);
      console.log("-----------------------------------");
    }
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetAddress: InitFacet.address,
      initArgs: [fertChunks[i]],
      bip: false,
      verbose: verbose,
      account: account,
      checkGas: true
    });
  }
}

exports.reseed5 = reseed5;
