const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");

async function reseed6(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue deposits.\n");

  // Files
  let depositsPath;
  if (mock) {
    depositsPath = "./reseed/data/mocks/r6-deposits-mock.json";
  } else {
    depositsPath = "./reseed/data/r6-deposits.json";
  }
  const beanDeposits = JSON.parse(await fs.readFileSync(depositsPath));

  targetEntriesPerChunk = 800;
  depositChunks = await splitEntriesIntoChunksOptimized(beanDeposits, targetEntriesPerChunk);
  const InitFacet = await ethers.getContractFactory("ReseedSilo", account);
  for (let i = 0; i < depositChunks.length; i++) {
    await updateProgress(i + 1, plotChunks.length);
    if (verbose) {
      console.log("Data chunk:", depositChunks[i]);
      console.log("-----------------------------------");
    }
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetAddress: InitFacet.address,
      initArgs: [depositChunks[i]],
      bip: false,
      verbose: verbose,
      account: account,
      checkGas: true,
      initFacetNameInfo: "ReseedSilo"
    });
  }
}

exports.reseed6 = reseed6;
