const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

// Files
let barnRaisePath;
let mock = true;
if (mock) {
  barnRaisePath = "./reseed/data/mocks/r5-barn-raise-mock.json";
} else {
  barnRaisePath = "./reseed/data/r5-barn-raise.json";
}

async function reseed5(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue fertilizer, reinitialize fertilizer holder state.\n");
  const fertilizerIds = JSON.parse(
    await fs.readFileSync(barnRaisePath)
  );

  chunkSize = 4;
  fertChunks = splitEntriesIntoChunks(fertilizerIds, chunkSize);
  
  for (let i = 0; i < fertChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${fertChunks.length}`);
    console.log("Data chunk:", fertChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedBarn",
      initArgs: [fertChunks[i]],
      bip: false,
      verbose: true,
      account: account,
      checkGas: true
    });

    console.log("-----------------------------------");
  }
}

exports.reseed5 = reseed5;
