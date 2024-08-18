const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Fertilizer deployment was put in a separate script to avoid exceeding the contract size in ReseedBean.
async function reseedDeployFertilizer(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseedDeployFertilizer: Deploy the Fertilizer proxy and implementation.\n");

  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedDeployFertilizer",
    initArgs: [],
    bip: false,
    verbose: true,
    account: account,
    checkGas: true
  });
  console.log("-----------------------------------");
}

exports.reseedDeployFertilizer = reseedDeployFertilizer;
