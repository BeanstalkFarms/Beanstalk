const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
let accountStatusesPath;
let mock = true;
if (mock) {
  accountStatusesPath = "./reseed/data/mocks/r7-account-status-mock.json";
} else {
  accountStatusesPath = "./reseed/data/r7-account-status.json";
}

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseedAccountStatus:.\n");
  let statuses = JSON.parse(await fs.readFileSync(accountStatusesPath));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedAccountStatus",
    initArgs: [statuses],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed7 = reseed7;
