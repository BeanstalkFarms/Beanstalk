const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { retryOperation } = require("../utils/read.js");
const { L2_FERTILIZER, L2_RESEED_BEAN } = require("../test/hardhat/utils/constants.js");

// Files
const INIT_SUPPLY = "./reseed/data/r2/L2_initial_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/r2/L2_well_balances.json";
const EXTERNAL_UNRIPE_BEAN = "./reseed/data/r2/L2_external_unripe_balances.json";
const EXTERNAL_UNRIPE_BEAN_LP = "./reseed/data/r2/L2_external_unripe_lp_balances.json";

/**
 * reseed2 re-initializes the bean tokens mints beans to the bcm and deploys the upgradeable wells
**/
async function reseed2(account, L2Beanstalk, mock, verbose) {
  verbose = true;
  console.log("-----------------------------------");
  console.log("reseed2: deploy bean tokens.\n");
  [beanSupply, unripeBeanSupply, unripeLpSupply] = JSON.parse(await fs.readFileSync(INIT_SUPPLY));
  [balancesInBeanEthWell, balancesInBeanWstEthWell, balancesInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );
  externalUrBean = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE_BEAN));
  externalUrBeanLP = JSON.parse(await fs.readFileSync(EXTERNAL_UNRIPE_BEAN_LP));

  // get the bean sided liquidity from the L1 wells to mint it to the bcm.
  const beansInBeanEthWell = balancesInBeanEthWell[0];
  const beansInBeanWstEthWell = balancesInBeanWstEthWell[0];
  const beansInBeanStableWell = balancesInBeanStableWell[0];

  // call init:
  await retryOperation(async () => {
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: [],
      initFacetName: "ReseedBean",
      initFacetAddress: L2_RESEED_BEAN,
      initArgs: [
        beanSupply,
        unripeBeanSupply,
        unripeLpSupply,
        beansInBeanEthWell,
        beansInBeanWstEthWell,
        beansInBeanStableWell,
        externalUrBean,
        externalUrBeanLP,
        L2_FERTILIZER
      ],
      bip: false,
      verbose: false,
      account: account
    });
  });

  console.log("-----------------------------------");
}

exports.reseed2 = reseed2;
