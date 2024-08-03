const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BEAN_INTERNAL_BALANCES = "./reseed/data/r6/bean_internal.json";

async function reseed7(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed7: reissue internal balances.\n");

  let beanBalances = JSON.parse(await fs.readFileSync(BEAN_INTERNAL_BALANCES));

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedInternalBalances",
    initArgs: [
      beanBalances,
    ],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}

exports.reseed7 = reseed7;
