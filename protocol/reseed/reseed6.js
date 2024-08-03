const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_DEPOSITS = "./reseed/data/r5/bean_deposits.json";

async function reseed6(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue deposits.\n");

  let beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedSilo",
    initArgs: [
      beanDeposits,
    ],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}

exports.reseed6 = reseed6;
