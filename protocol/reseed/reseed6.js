const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

async function reseed6(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseed6: reissue deposits.\n");

  // Files
  let depositsPath;
  if (mock) {
    depositsPath = "./reseed/data/mocks/r6-deposits-mock.json";
  } else {
    depositsPath = "./reseed/data/r6-deposits.json";
  }
  let beanDeposits = JSON.parse(await fs.readFileSync(depositsPath));

  chunkSize = 5;
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
      account: account,
      checkGas: true
    });
    console.log("-----------------------------------");
  }
}

exports.reseed6 = reseed6;
