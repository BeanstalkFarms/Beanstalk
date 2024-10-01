const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunksOptimized, updateProgress } = require("../utils/read.js");
const { retryOperation } = require("../utils/read.js");
const { L2_RESEED_ACCOUNT_STATUS } = require("../test/hardhat/utils/constants.js");

async function reseed7(account, L2Beanstalk, mock, verbose = false) {
  console.log("-----------------------------------");
  console.log("reseedAccountStatus:.\n");

  // Files
  let accountStatusesPath;
  if (mock) {
    accountStatusesPath = "./reseed/data/mocks/r7-account-status-mock.json";
  } else {
    accountStatusesPath = "./reseed/data/r7-account-status.json";
  }
  const statuses = JSON.parse(await fs.readFileSync(accountStatusesPath));

  targetEntriesPerChunk = 400;
  statusChunks = await splitEntriesIntoChunksOptimized(statuses, targetEntriesPerChunk);
  for (let i = 0; i < statusChunks.length; i++) {
    await updateProgress(i + 1, statusChunks.length);
    if (verbose) {
      console.log("Data chunk:", statusChunks[i]);
      console.log("-----------------------------------");
    }
    await retryOperation(async () => {
      await upgradeWithNewFacets({
        diamondAddress: L2Beanstalk,
        facetNames: [],
        initFacetName: "ReseedAccountStatus",
        initFacetAddress: L2_RESEED_ACCOUNT_STATUS,
        initArgs: [statusChunks[i]],
        bip: false,
        verbose: verbose,
        account: account,
        initFacetNameInfo: "ReseedAccountStatus"
      });
    });
  }
}
exports.reseed7 = reseed7;
