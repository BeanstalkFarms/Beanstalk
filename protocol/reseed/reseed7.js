const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

// Files
let accountStatusesPath;
let mock = false;
if (mock) {
  accountStatusesPath = "./reseed/data/mocks/r7-account-status-mock.json";
} else {
  accountStatusesPath = "./reseed/data/r7-account-status.json";
}

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseedAccountStatus:.\n");
  let statuses = JSON.parse(await fs.readFileSync(accountStatusesPath));

  chunkSize = 5;
  statusChunks = splitEntriesIntoChunks(statuses, chunkSize);

  for (let i = 0; i < statusChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${statusChunks.length}`);
    console.log("Data chunk:", statusChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedAccountStatus",
      initArgs: [statusChunks[i]],
      bip: false,
      verbose: true,
      account: account
    });
    console.log("-----------------------------------");
  }
}
exports.reseed7 = reseed7;
