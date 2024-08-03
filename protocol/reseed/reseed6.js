const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

// Files
const BEAN_DEPOSITS = "./reseed/data/r6/bean_deposits.json";

async function reseed6(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue deposits.\n");

  let beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));

  chunkSize = 2;
  depositChunks = splitEntriesIntoChunks(beanDeposits, chunkSize);

  for (let i = 0; i < depositChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${depositChunks.length}`);
    console.log("Data chunk:", depositChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedSilo",
      initArgs: [depositChunks[i]],
      bip: false,
      verbose: true,
      account: account
    });
    console.log("-----------------------------------");
  }
}

exports.reseed6 = reseed6;
