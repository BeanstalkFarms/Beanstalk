const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");
const { retryOperation } = require("../utils/read.js");
const { L2_RESEED_SILO_REVISED } = require("../test/hardhat/utils/constants.js");

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

  targetEntriesPerChunk = 400;
  depositChunks = await splitEntriesIntoChunksOptimized(beanDeposits, targetEntriesPerChunk);
  for (let i = 0; i < depositChunks.length; i++) {
    await updateProgress(i + 1, depositChunks.length);
    if (verbose) {
      console.log("Data chunk:", depositChunks[i]);
      console.log("-----------------------------------");
    }
    await retryOperation(async () => {
      await upgradeWithNewFacets({
        diamondAddress: L2Beanstalk,
        facetNames: [],
        initFacetName: "ReseedSiloRevised",
        initFacetAddress: L2_RESEED_SILO_REVISED,
        initArgs: [depositChunks[i]],
        bip: false,
        verbose: verbose,
        account: account,
        checkGas: true,
        initFacetNameInfo: "ReseedSilo"
      });
    });
  }
}

exports.reseed6 = reseed6;
