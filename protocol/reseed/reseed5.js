const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { splitEntriesIntoChunks } = require("../utils/read.js");

async function reseed5(account, L2Beanstalk, mock) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue fertilizer, reinitialize fertilizer holder state.\n");

  // Files
  let barnRaisePath;
  if (mock) {
    barnRaisePath = "./reseed/data/mocks/r5-barn-raise-mock.json";
  } else {
    barnRaisePath = "./reseed/data/r5-barn-raise.json";
  }
  const fertilizerIds = JSON.parse(await fs.readFileSync(barnRaisePath));

  chunkSize = 4;
  fertChunks = splitEntriesIntoChunks(fertilizerIds, chunkSize);
  const InitFacet = await ethers.getContractFactory("ReseedBarn", account);
  for (let i = 0; i < fertChunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${fertChunks.length}`);
    console.log("Data chunk:", fertChunks[i]);
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetAddress: InitFacet.address,
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
