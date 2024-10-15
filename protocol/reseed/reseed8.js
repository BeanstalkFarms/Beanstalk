const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");
const { retryOperation } = require("../utils/read.js");
const { L2_RESEED_INTERNAL_BALANCES } = require("../test/hardhat/utils/constants.js");

async function reseed8(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseed8: reissue internal balances.\n");

  // Files
  let internalBalancesPath;
  if (mock) {
    internalBalancesPath = "./reseed/data/mocks/r8-internal-balances-mock.json";
  } else {
    internalBalancesPath = "./reseed/data/r8-internal-balances.json";
  }

  let beanBalances = JSON.parse(await fs.readFileSync(internalBalancesPath));

  targetEntriesPerChunk = 500;
  balanceChunks = await splitEntriesIntoChunksOptimized(beanBalances, targetEntriesPerChunk);
  for (let i = 0; i < balanceChunks.length; i++) {
    await updateProgress(i + 1, balanceChunks.length);
    if (verbose) {
      console.log("Data chunk:", balanceChunks[i]);
      console.log("-----------------------------------");
    }
    await retryOperation(async () => {
      await upgradeWithNewFacets({
        diamondAddress: L2Beanstalk,
        facetNames: [],
        initFacetName: "ReseedInternalBalances",
        initFacetAddress: L2_RESEED_INTERNAL_BALANCES,
        initArgs: [balanceChunks[i]],
        bip: false,
        verbose: verbose,
        account: account,
        checkGas: true,
        initFacetNameInfo: "ReseedInternalBalances"
      });
    });
  }
}

exports.reseed8 = reseed8;
