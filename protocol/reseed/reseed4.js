const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

// Files
const BARN_RAISE = "./replant/data/r4-barn-raise.json";

async function reseed4(account, L2Beanstalk) {
  console.log("-----------------------------------");
  console.log("reseed4: reissue fertilizer, reinitialize fertilizer holder state.\n");
  const [fertilizerIds, ACTIVE_FERTILIZER, FERTILIZED_INDEX, UNFERTILIZED_INDEX, BPF] = JSON.parse(
    await fs.readFileSync(BARN_RAISE)
  );
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: [],
    initFacetName: "ReseedBarn",
    initArgs: [fertilizerIds, ACTIVE_FERTILIZER, FERTILIZED_INDEX, UNFERTILIZED_INDEX, BPF],
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed4 = reseed4;
