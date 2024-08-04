const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BARN_RAISE = "./reseed/data/r5-barn-raise.json";

async function reseed5(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed5: reissue fertilizer, reinitialize fertilizer holder state.\n");
  const fertilizerIds = JSON.parse(
    await fs.readFileSync(BARN_RAISE)
  );
  
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedBarn",
    initArgs: [fertilizerIds],
    bip: false,
    verbose: true,
    account: account,
    checkGas: true
  });
  console.log("-----------------------------------");
}
exports.reseed5 = reseed5;
