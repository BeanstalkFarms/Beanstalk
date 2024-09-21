const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { retryOperation } = require("../utils/read.js");
const { L2_FERTILIZER } = require("../test/hardhat/utils/constants.js");

// Files
const INIT_SUPPLY = "./reseed/data/r2/L2_initial_supply.json";
const INIT_WELL_BALANCES = "./reseed/data/r2/L2_well_balances.json";
const EXTERNAL_UNRIPE_BEAN = "./reseed/data/r2/L2_external_unripe_balances.json";
const EXTERNAL_UNRIPE_BEAN_LP = "./reseed/data/r2/L2_external_unripe_lp_balances.json";

/**
 * reseed8 approves beanstalk to use the BCM's wsteth, eth, and a stablecoin,
 * where it will 1) transfer to a well 2) sync and add liquidity, upon deployment.
 * note: for testing purposes, the L2 is on base, and the stablecoin is USDC, but can be switched based on the discretion of the DAO.
 */
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
