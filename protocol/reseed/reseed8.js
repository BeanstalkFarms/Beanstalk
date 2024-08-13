const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

// Files
let internalBalancesPath;
let mock = true;
if (mock) {
  internalBalancesPath = "./reseed/data/mocks/r8-internal-balances-mock.json";
} else {
  internalBalancesPath = "./reseed/data/r8-internal-balances.json";
}

async function reseed8(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed8: reissue internal balances.\n");

  let beanBalances = JSON.parse(await fs.readFileSync(internalBalancesPath));

  chunkSize = 4;
  balanceChunks = splitEntriesIntoChunks(beanBalances, chunkSize);

  for (let i = 0; i < balanceChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${balanceChunks.length}`);
    console.log("Data chunk:", balanceChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedInternalBalances",
      initArgs: [balanceChunks[i]],
      bip: false,
      verbose: true,
      account: account,
      checkGas: true
    });
    console.log("-----------------------------------");
  }
}

exports.reseed8 = reseed8;
