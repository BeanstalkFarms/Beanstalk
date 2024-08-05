const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const ACCOUNT_STATUSES = "./reseed/data/r7-account-status.json";

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseedAccountStatus:.\n");
  let statuses = JSON.parse(await fs.readFileSync(ACCOUNT_STATUSES));

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
